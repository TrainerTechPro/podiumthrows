import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Canonical-surface screenshot harness for PR 1.
 *
 * Produces 40 PNGs in tasks/screenshots/pr1/ — 10 surfaces × 2 themes ×
 * 2 viewports. Each file is the fullPage capture for that (surface, theme,
 * viewport) triple. Output is gitignored via tasks/ in .gitignore; only
 * the MANIFEST.md lists what should exist.
 *
 * Intended to also serve as the visual-regression fence for PR 2
 * (schema consolidation). Zero-diff screenshots across PR 2 commits
 * prove the schema cleanup didn't alter user-facing surfaces.
 */

const OUT_DIR = path.resolve(process.cwd(), "tasks/screenshots/pr1");
fs.mkdirSync(OUT_DIR, { recursive: true });

const AUTH_DIR = path.resolve(process.cwd(), "e2e/.auth");
const COACH_STORAGE = path.join(AUTH_DIR, "coach.json");
const ATHLETE_STORAGE = path.join(AUTH_DIR, "athlete.json");

const BASE_URL = "http://localhost:3000";

type Surface = { role: "coach" | "athlete"; path: string; slug: string };

// PR 6 (coach-IA consolidation, 2026-04-25) replaced three coach canonical
// surfaces with the new top-level destinations:
//   /coach/plans     → /coach/library    (Plans is now Library?view=plans)
//   /coach/schedule  → /coach/calendar   (Calendar absorbed Schedule)
//   /coach/hub       → killed entirely   (content distributed to Dashboard
//                                          + Roster header rollup)
// Canonical baselines for the new surfaces (calendar, library, builder)
// regenerate on the next `npm run screenshots:canonical` run; the smoke
// assertion below only checks that each URL renders 200 for the role.
const SURFACES: Surface[] = [
  { role: "athlete", path: "/athlete/dashboard", slug: "athlete-dashboard" },
  { role: "athlete", path: "/athlete/log-session", slug: "athlete-log-session" },
  { role: "athlete", path: "/athlete/self-program", slug: "athlete-self-program" },
  { role: "athlete", path: "/athlete/throws", slug: "athlete-throws" },
  { role: "athlete", path: "/athlete/profile", slug: "athlete-profile" },
  { role: "coach", path: "/coach/dashboard", slug: "coach-dashboard" },
  { role: "coach", path: "/coach/calendar", slug: "coach-calendar" },
  { role: "coach", path: "/coach/library", slug: "coach-library" },
  { role: "coach", path: "/coach/builder", slug: "coach-builder" },
  { role: "coach", path: "/coach/athletes", slug: "coach-athletes" },
];

const VIEWPORTS = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

const THEMES = ["light", "dark"] as const;

test.describe.configure({ mode: "parallel" });
test.describe("Canonical-surface screenshots", () => {
  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      for (const surface of SURFACES) {
        const filename = `${surface.slug}__${theme}__${vp.name}.png`;

        test(filename, async ({ browser }) => {
          const storageState = surface.role === "coach" ? COACH_STORAGE : ATHLETE_STORAGE;

          const context = await browser.newContext({
            storageState,
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

            const landedPath = new URL(page.url()).pathname;
            expect(
              landedPath,
              `Expected ${surface.path}; landed on ${landedPath} (auth or flag gate?)`
            ).toBe(surface.path);

            // Ensure dark class matches requested theme regardless of the
            // server-rendered initial value (belt + suspenders).
            await page.evaluate((t) => {
              document.documentElement.classList.toggle("dark", t === "dark");
            }, theme);

            // Settle animations + staggered reveals.
            await page.waitForTimeout(500);

            await page.screenshot({
              path: path.join(OUT_DIR, filename),
              fullPage: true,
            });
          } finally {
            await context.close();
          }
        });
      }
    }
  }
});
