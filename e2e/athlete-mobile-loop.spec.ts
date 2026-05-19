import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ATHLETE_1, loginViaAPI } from "./helpers/auth";

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
 * Auth: each screenshot context logs in through the API after loading /login
 * for a CSRF cookie. That keeps the harness independent from stale
 * e2e/.auth/*.json files while still avoiding the form-state race in dev HMR.
 */

const OUT_DIR = path.resolve(process.cwd(), "tasks/screenshots/athlete-ux-audit-2");
fs.mkdirSync(OUT_DIR, { recursive: true });

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
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 2,
        });

        try {
          await loginViaAPI(context, "http://localhost:3000", ATHLETE_1.email, ATHLETE_1.password);

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
