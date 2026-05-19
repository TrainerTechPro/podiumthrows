import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Screenshot fence for the data-surface upgrade (DataTable mobile cards,
 * URL state, error/empty/loading variants). Captures coach tables that
 * collapse to cards on mobile + athlete lists that already use cards.
 *
 * Output: `tasks/screenshots/data-surfaces/`. Mobile (390) + desktop (1440).
 * One theme — these are layout/structure shots, not visual-design fences.
 */

const OUT_DIR = path.resolve(process.cwd(), "tasks/screenshots/data-surfaces");
fs.mkdirSync(OUT_DIR, { recursive: true });

const AUTH_DIR = path.resolve(process.cwd(), "e2e/.auth");
const COACH_STORAGE = path.join(AUTH_DIR, "coach.json");
const ATHLETE_STORAGE = path.join(AUTH_DIR, "athlete.json");

type Surface = { role: "coach" | "athlete"; path: string; slug: string };

const SURFACES: Surface[] = [
  { role: "coach", path: "/coach/athletes", slug: "coach-athletes" },
  { role: "coach", path: "/coach/plans", slug: "coach-plans" },
  { role: "coach", path: "/coach/exercises", slug: "coach-exercises" },
  { role: "coach", path: "/coach/notifications", slug: "coach-notifications" },
  { role: "coach", path: "/coach/competitions", slug: "coach-competitions" },
  { role: "coach", path: "/coach/athlete-logs", slug: "coach-athlete-logs" },
  { role: "coach", path: "/coach/practices", slug: "coach-practices" },
  { role: "coach", path: "/coach/wellness", slug: "coach-wellness" },
  { role: "coach", path: "/coach/goals", slug: "coach-goals" },
  { role: "athlete", path: "/athlete/throws/history", slug: "athlete-throws-history" },
  { role: "athlete", path: "/athlete/notifications", slug: "athlete-notifications" },
  { role: "athlete", path: "/athlete/goals", slug: "athlete-goals" },
  { role: "athlete", path: "/athlete/wellness", slug: "athlete-wellness" },
  { role: "athlete", path: "/athlete/throws/trends", slug: "athlete-throws-trends" },
];

const VIEWPORTS = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

test.describe.configure({ mode: "parallel" });
test.describe("Data-surface screenshots", () => {
  for (const vp of VIEWPORTS) {
    for (const surface of SURFACES) {
      const filename = `${surface.slug}__${vp.name}.png`;

      test(filename, async ({ browser }) => {
        const storageState = surface.role === "coach" ? COACH_STORAGE : ATHLETE_STORAGE;

        const context = await browser.newContext({
          storageState,
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

          // Dismiss the WhatsNew release modal if it pops up — otherwise it
          // covers the table/list we're trying to capture. The "Got it" button
          // is the canonical ack control.
          const gotIt = page.getByRole("button", { name: /^Got it$/i }).first();
          if (await gotIt.isVisible().catch(() => false)) {
            await gotIt.click().catch(() => {});
            await page.waitForTimeout(200);
          }

          // Settle animations / staggered reveals
          await page.waitForTimeout(800);

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
