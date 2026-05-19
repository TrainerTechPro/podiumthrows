import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ATHLETE_1, COACH, loginViaAPI } from "./helpers/auth";

/**
 * Mobile keyboard-open screenshots — verifies that sticky CTAs and form
 * actions remain reachable when the iOS keyboard occupies the bottom of
 * the viewport.
 *
 * Playwright can't directly simulate the iOS virtual keyboard, so we
 * approximate by shrinking viewport HEIGHT to the keyboard-open size
 * documented by Apple: on iPhone SE the keyboard takes ~258px (height
 * 667 → 409 visible), on iPhone 14/15 Pro it takes ~291px (height 844
 * → 553 visible). The width stays the same.
 *
 * What this catches:
 *   - Sticky bottom CTAs that should reflow above the keyboard but
 *     don't (no env(keyboard-inset-height) handling, no resize listener)
 *   - Forms that need to scroll the focused input into view but pin a
 *     full-height layout
 *   - Modals whose "Save" button gets hidden by the keyboard
 *
 * Output: tasks/screenshots/mobile-keyboard/ (gitignored).
 *
 * Surfaces — the four flows the goal calls out (log-session, auth,
 * session, settings) plus the wellness check-in which is the other
 * common form-heavy mobile screen.
 */

const OUT_DIR = path.resolve(process.cwd(), "tasks/screenshots/mobile-keyboard");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = "http://localhost:3000";

type Surface = {
  slug: string;
  path: string;
  auth: "none" | "coach" | "athlete";
};

const SURFACES: Surface[] = [
  { slug: "kb-login", path: "/login", auth: "none" },
  { slug: "kb-register", path: "/register", auth: "none" },
  { slug: "kb-athlete-log-session", path: "/athlete/log-session", auth: "athlete" },
  { slug: "kb-athlete-wellness", path: "/athlete/wellness", auth: "athlete" },
  { slug: "kb-athlete-settings", path: "/athlete/settings", auth: "athlete" },
  { slug: "kb-coach-settings", path: "/coach/settings", auth: "coach" },
];

// Visible viewport heights with the iOS keyboard occupying the bottom.
const VIEWPORTS = [
  { name: "mobile-375-se-kb", width: 375, height: 409 }, // 667 - 258
  { name: "mobile-390-kb", width: 390, height: 553 }, // 844 - 291
];

test.describe.configure({ mode: "serial" });
test.describe("Mobile keyboard-open screenshots", () => {
  for (const vp of VIEWPORTS) {
    for (const surface of SURFACES) {
      const filename = `${surface.slug}__${vp.name}.png`;

      test(filename, async ({ browser }) => {
        test.setTimeout(60_000);

        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 2,
        });

        try {
          await context.addCookies([{ name: "theme", value: "dark", url: BASE_URL }]);

          if (surface.auth === "athlete") {
            await loginViaAPI(context, BASE_URL, ATHLETE_1.email, ATHLETE_1.password);
          } else if (surface.auth === "coach") {
            await loginViaAPI(context, BASE_URL, COACH.email, COACH.password);
          }

          const page = await context.newPage();
          const response = await page.goto(surface.path, {
            waitUntil: "domcontentloaded",
            timeout: 30_000,
          });
          expect(response?.ok(), `${surface.path} -> ${response?.status()}`).toBeTruthy();

          const landed = new URL(page.url()).pathname;
          expect(landed, `Expected ${surface.path}; landed on ${landed}`).toBe(surface.path);

          // Force-focus the first text input so the screenshot reflects the
          // actively-typing state, not the resting layout.
          await page
            .locator(
              'input[type="text"], input[type="email"], input[type="password"], textarea, input:not([type])'
            )
            .first()
            .focus({ timeout: 5_000 })
            .catch(() => {
              // Surface has no input — capture the resting layout at the
              // truncated viewport instead. Still tells us if sticky bottom
              // actions clear the keyboard region.
            });

          await page.waitForTimeout(300);

          await page.screenshot({
            path: path.join(OUT_DIR, filename),
            fullPage: false, // viewport-only — we want to see what's visible above the keyboard
          });
        } finally {
          await context.close();
        }
      });
    }
  }
});
