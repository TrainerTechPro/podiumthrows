import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Athlete mobile-daily-loop screenshot harness (UX audit 2).
 *
 * Captures iPhone SE (375x667) + iPhone 14/15 Pro (390x844) at the five
 * canonical athlete surfaces. The SE viewport is the worst-case for thumb
 * reach — if the primary CTA on /athlete/dashboard sits in the lower half
 * of the SE viewport, every newer iPhone is comfortable.
 *
 * Output: tasks/screenshots/athlete-ux-audit-2/{surface}__{viewport}.png
 *   - First-viewport (above the fold) by default.
 *   - Full-page variants suffixed __fullpage.
 *
 * Auth: relies on a pre-baked storage-state at e2e/.auth/athlete.json.
 * Generate it once with the dev server running:
 *
 *   JAR=/tmp/jar.txt
 *   curl -s -c $JAR -o /dev/null http://localhost:3000/login
 *   CSRF=$(awk '/csrf-token/{print $7}' $JAR)
 *   curl -s -b $JAR -c $JAR -X POST http://localhost:3000/api/auth/login \
 *     -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
 *     -d '{"email":"athlete1@example.com","password":"athlete123"}'
 *   # ...then convert $JAR cookies into Playwright storageState JSON.
 *
 * This sidesteps the login rate-limiter (one login per harness run) and
 * the form-state race in dev mode HMR.
 */

const OUT_DIR = path.resolve(process.cwd(), "tasks/screenshots/athlete-ux-audit-2");
fs.mkdirSync(OUT_DIR, { recursive: true });

const ATHLETE_STORAGE = path.resolve(process.cwd(), "e2e/.auth/athlete.json");

const SURFACES = [
  { path: "/athlete/dashboard", slug: "athlete-dashboard" },
  { path: "/athlete/sessions", slug: "athlete-sessions" },
  { path: "/athlete/log-session", slug: "athlete-log-session" },
  { path: "/athlete/throws", slug: "athlete-throws" },
  { path: "/athlete/profile", slug: "athlete-profile" },
];

const VIEWPORTS = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-14-pro", width: 390, height: 844 },
];

test.describe("Athlete mobile daily loop", () => {
  for (const vp of VIEWPORTS) {
    for (const surface of SURFACES) {
      test(`${surface.slug}__${vp.name}`, async ({ browser }) => {
        if (!fs.existsSync(ATHLETE_STORAGE)) {
          test.skip(true, `Missing ${ATHLETE_STORAGE} — generate it first.`);
        }

        const context = await browser.newContext({
          storageState: ATHLETE_STORAGE,
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 2,
        });

        try {
          const page = await context.newPage();
          const response = await page.goto(surface.path, {
            waitUntil: "networkidle",
            timeout: 30_000,
          });
          expect(response?.ok(), `${surface.path} -> ${response?.status()}`).toBeTruthy();

          const landed = new URL(page.url()).pathname;
          expect(landed, `Expected ${surface.path}; landed on ${landed}`).toBe(surface.path);

          // Let entrance animations + staggered reveals settle.
          await page.waitForTimeout(600);

          await page.screenshot({
            path: path.join(OUT_DIR, `${surface.slug}__${vp.name}.png`),
            fullPage: false,
          });

          await page.screenshot({
            path: path.join(OUT_DIR, `${surface.slug}__${vp.name}__fullpage.png`),
            fullPage: true,
          });
        } finally {
          await context.close();
        }
      });
    }
  }
});
