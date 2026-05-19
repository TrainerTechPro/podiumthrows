import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Mobile screenshots for the trust/setup surfaces — register, login,
 * athlete onboarding, coach welcome, settings — at the two breakpoints the
 * athlete app must hold (iPhone SE 375px, iPhone 14/15 Pro 390px).
 *
 * These are the screens where iOS Safari focus-zoom + sticky-CTA clipping
 * + keyboard-coverage hurt the most. The PNGs land in
 * tasks/screenshots/auth-onboarding/ (gitignored under tasks/).
 *
 * Auth surfaces (register/login) use the `no-auth` project so they don't
 * carry a logged-in cookie. Athlete-onboarding + coach-welcome + settings
 * use the role's saved storageState.
 */

const OUT_DIR = path.resolve(process.cwd(), "tasks/screenshots/auth-onboarding");
fs.mkdirSync(OUT_DIR, { recursive: true });

const AUTH_DIR = path.resolve(process.cwd(), "e2e/.auth");
const COACH_STORAGE = path.join(AUTH_DIR, "coach.json");
const ATHLETE_STORAGE = path.join(AUTH_DIR, "athlete.json");

const BASE_URL = "http://localhost:3000";

type Surface = {
  slug: string;
  path: string;
  /** "none" = no auth cookie; "coach"/"athlete" = role storageState. */
  auth: "none" | "coach" | "athlete";
  /** Page may resolve to a different pathname (redirects/etc.) — don't assert. */
  allowRedirect?: boolean;
};

const SURFACES: Surface[] = [
  { slug: "register", path: "/register", auth: "none" },
  { slug: "login", path: "/login", auth: "none" },
  // Athlete onboarding requires an athlete that hasn't finished it yet.
  // Seeded athlete1 is post-onboarding, so /athlete/onboarding may redirect
  // to /athlete/dashboard. The screenshot still proves the route renders.
  { slug: "athlete-onboarding", path: "/athlete/onboarding", auth: "athlete", allowRedirect: true },
  { slug: "coach-welcome", path: "/coach/onboarding/welcome", auth: "coach", allowRedirect: true },
  { slug: "athlete-settings", path: "/athlete/settings", auth: "athlete" },
  { slug: "coach-settings", path: "/coach/settings", auth: "coach" },
];

const VIEWPORTS = [
  { name: "375-se", width: 375, height: 667 },
  { name: "390-pro", width: 390, height: 844 },
];

test.describe.configure({ mode: "parallel" });
test.describe("Auth + onboarding + settings mobile screenshots", () => {
  for (const vp of VIEWPORTS) {
    for (const surface of SURFACES) {
      const filename = `${surface.slug}__${vp.name}.png`;
      test(filename, async ({ browser }) => {
        const context = await browser.newContext({
          ...(surface.auth === "coach"
            ? { storageState: COACH_STORAGE }
            : surface.auth === "athlete"
              ? { storageState: ATHLETE_STORAGE }
              : {}),
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 2,
        });

        try {
          // Dark theme: matches the athlete OLED default and the auth-shell's
          // dark surface. Toggling explicit theme here keeps screenshots
          // deterministic between runs.
          await context.addCookies([{ name: "theme", value: "dark", url: BASE_URL }]);

          const page = await context.newPage();
          const response = await page.goto(surface.path, {
            waitUntil: "networkidle",
            timeout: 30_000,
          });
          expect(response, `${surface.path} produced no response`).toBeTruthy();

          await page.evaluate(() => {
            document.documentElement.classList.add("dark");
          });
          await page.waitForTimeout(400);

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
});
