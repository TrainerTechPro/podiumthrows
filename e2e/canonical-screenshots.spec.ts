import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

/**
 * Canonical-surface screenshot + accessibility harness.
 *
 * For every (surface, theme, viewport) triple this spec:
 *   1. Renders the route at the requested viewport with the requested theme
 *   2. Asserts the URL didn't redirect away (auth/flag gates would catch here)
 *   3. Captures the full page as a PNG into tasks/screenshots/pr1/
 *   4. At the desktop-1440 viewport only, runs an @axe-core/playwright scan
 *      and asserts the serious/critical violation count is <= the per-surface
 *      baseline in .a11y-baseline.json. New violations fail the test;
 *      pre-existing ones are grandfathered until a cleanup PR ratchets the
 *      baseline down. One scan per (surface, theme) is sufficient because
 *      a11y issues are content/markup, not layout sizing.
 *
 * Total: 14 app surfaces × 2 themes × 4 viewports + 2 marketing × 1 theme
 *        × 4 viewports = 120 PNGs. Output is gitignored via tasks/.
 *
 * Designed as the visual-regression fence for IA migrations. Zero-diff
 * screenshots across a refactor commit prove the refactor didn't alter
 * user-facing surfaces.
 */

// Per-(slug, theme) axe baseline. Missing keys default to 0 (any violation
// fails). Set this to current state in a single audit, ratchet down per
// surface in cleanup PRs. See tasks/ui-ux-qa-checklist.md §Known drift.
const A11Y_BASELINE_FILE = path.resolve(process.cwd(), ".a11y-baseline.json");
const A11Y_BASELINE: Record<string, number> = (() => {
  try {
    const raw = fs.readFileSync(A11Y_BASELINE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, number | string>;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
})();

const OUT_DIR = path.resolve(process.cwd(), "tasks/screenshots/pr1");
fs.mkdirSync(OUT_DIR, { recursive: true });

const AUTH_DIR = path.resolve(process.cwd(), "e2e/.auth");
const COACH_STORAGE = path.join(AUTH_DIR, "coach.json");
const ATHLETE_STORAGE = path.join(AUTH_DIR, "athlete.json");

const BASE_URL = "http://localhost:3000";

type Auth = "coach" | "athlete" | "none";
type Surface = {
  auth: Auth;
  path: string;
  slug: string;
  /** Surface may redirect (e.g., post-auth athletes hitting /athlete/onboarding). */
  allowRedirect?: boolean;
};

const SURFACES: Surface[] = [
  // Auth — no storageState. iOS focus-zoom + sticky-CTA clip + keyboard
  // coverage all hurt most here; covered at all four viewports.
  { auth: "none", path: "/login", slug: "auth-login" },
  { auth: "none", path: "/register", slug: "auth-register" },

  // Athlete primary loop.
  { auth: "athlete", path: "/athlete/dashboard", slug: "athlete-dashboard" },
  { auth: "athlete", path: "/athlete/sessions", slug: "athlete-sessions" },
  { auth: "athlete", path: "/athlete/log-session", slug: "athlete-log-session" },
  { auth: "athlete", path: "/athlete/throws", slug: "athlete-throws" },
  { auth: "athlete", path: "/athlete/profile", slug: "athlete-profile" },
  { auth: "athlete", path: "/athlete/settings", slug: "athlete-settings" },

  // Coach primary loop. /coach/athletes is roster; deep-link to athlete
  // detail is exercised by data-surfaces-screenshots.spec.ts.
  { auth: "coach", path: "/coach/dashboard", slug: "coach-dashboard" },
  { auth: "coach", path: "/coach/athletes", slug: "coach-athletes" },
  { auth: "coach", path: "/coach/calendar", slug: "coach-calendar" },
  { auth: "coach", path: "/coach/library", slug: "coach-library" },
  { auth: "coach", path: "/coach/builder", slug: "coach-builder" },
  { auth: "coach", path: "/coach/settings", slug: "coach-settings" },
];

// Marketing surfaces are always-dark per CLAUDE.md (no light variant by
// design). They run unauthenticated and only at the dark theme.
const MARKETING_SURFACES: { path: string; slug: string }[] = [
  { path: "/", slug: "marketing-home" },
  { path: "/pricing", slug: "marketing-pricing" },
];

const VIEWPORTS = [
  // iPhone SE — the tightest viewport the athlete app must work on.
  { name: "mobile-375-se", width: 375, height: 667 },
  // iPhone 14/15 Pro — the modern phone target.
  { name: "mobile-390", width: 390, height: 844 },
  // iPad portrait — coach surfaces use this for the sideline/practice case
  // and athlete surfaces sometimes get used here. Added per UI-QA goal.
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

const THEMES = ["light", "dark"] as const;

// Run axe only at the desktop-1440 capture. The DOM is the same across
// viewports for a11y purposes (axe checks content/markup, not layout
// sizing), so one scan per (surface, theme) is sufficient.
const AXE_VIEWPORT = "desktop-1440";

function storageStateFor(auth: Auth): string | undefined {
  if (auth === "coach") return COACH_STORAGE;
  if (auth === "athlete") return ATHLETE_STORAGE;
  return undefined;
}

test.describe.configure({ mode: "parallel" });
test.describe("Canonical-surface screenshots", () => {
  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      for (const surface of SURFACES) {
        const filename = `${surface.slug}__${theme}__${vp.name}.png`;

        test(filename, async ({ browser }) => {
          const storageState = storageStateFor(surface.auth);

          const context = await browser.newContext({
            ...(storageState ? { storageState } : {}),
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2,
          });

          try {
            await context.addCookies([{ name: "theme", value: theme, url: BASE_URL }]);

            const page = await context.newPage();
            const response = await page.goto(surface.path, {
              waitUntil: "networkidle",
              timeout: 30_000,
            });

            expect(response?.ok(), `${surface.path} responded ${response?.status()}`).toBeTruthy();

            if (!surface.allowRedirect) {
              const landedPath = new URL(page.url()).pathname;
              expect(
                landedPath,
                `Expected ${surface.path}; landed on ${landedPath} (auth or flag gate?)`
              ).toBe(surface.path);
            }

            // Match dark class to requested theme regardless of server render.
            await page.evaluate((t) => {
              document.documentElement.classList.toggle("dark", t === "dark");
            }, theme);

            await page.waitForTimeout(500);

            await page.screenshot({
              path: path.join(OUT_DIR, filename),
              fullPage: true,
            });

            // Accessibility gate — desktop only, see header comment.
            if (vp.name === AXE_VIEWPORT) {
              const results = await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
                .analyze();

              const blocking = results.violations.filter(
                (v) => v.impact === "serious" || v.impact === "critical"
              );
              const baselineKey = `${surface.slug}__${theme}`;
              const baseline = A11Y_BASELINE[baselineKey] ?? 0;

              expect(
                blocking.length,
                `axe found ${blocking.length} serious/critical violations on ${surface.path} (${theme}) — baseline ${baseline}:\n` +
                  blocking
                    .map((v) => `  · ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`)
                    .join("\n") +
                  `\nIf this fix is intentional, ratchet .a11y-baseline.json[${baselineKey}] down to ${blocking.length}.`
              ).toBeLessThanOrEqual(baseline);
            }
          } finally {
            await context.close();
          }
        });
      }
    }
  }

  // Marketing surfaces — always-dark, no auth. Same viewports + same axe gate.
  for (const vp of VIEWPORTS) {
    for (const surface of MARKETING_SURFACES) {
      const filename = `${surface.slug}__dark__${vp.name}.png`;

      test(filename, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 2,
        });

        try {
          const page = await context.newPage();
          const response = await page.goto(surface.path, {
            waitUntil: "networkidle",
            timeout: 30_000,
          });

          expect(response?.ok(), `${surface.path} responded ${response?.status()}`).toBeTruthy();

          await page.waitForTimeout(500);

          await page.screenshot({
            path: path.join(OUT_DIR, filename),
            fullPage: true,
          });

          if (vp.name === AXE_VIEWPORT) {
            const results = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
              .analyze();

            const blocking = results.violations.filter(
              (v) => v.impact === "serious" || v.impact === "critical"
            );
            const baselineKey = `${surface.slug}__dark`;
            const baseline = A11Y_BASELINE[baselineKey] ?? 0;

            expect(
              blocking.length,
              `axe found ${blocking.length} serious/critical violations on ${surface.path} — baseline ${baseline}:\n` +
                blocking
                  .map((v) => `  · ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`)
                  .join("\n") +
                `\nIf this fix is intentional, ratchet .a11y-baseline.json[${baselineKey}] down to ${blocking.length}.`
            ).toBeLessThanOrEqual(baseline);
          }
        } finally {
          await context.close();
        }
      });
    }
  }
});
