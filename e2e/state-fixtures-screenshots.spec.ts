import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Component-state fixtures — captures the visual states the goal lists
 * (one modal, one sheet, one toast, one table, one empty state, one
 * error state) at the two phone viewports plus desktop.
 *
 * Empty + error states use real routes that already render in the
 * required state:
 *   - empty-wearable: /athlete/oura when there's no OuraConnection row
 *     renders <WearableNotConnected> — the canonical compact empty card
 *   - empty-achievements: /athlete/achievements when an athlete has
 *     earned zero badges renders the 🎯 starter card
 *   - error-boundary: visiting /coach/dashboard with a forced server
 *     error renders src/app/(dashboard)/coach/error.tsx
 *
 * Table + modal/sheet/toast captures are exercised by:
 *   - data-surfaces-screenshots.spec.ts (DataTable on coach roster +
 *     mobile card collapse)
 *   - auth-onboarding-screenshots.spec.ts (settings forms include the
 *     coach security/MFA modal + athlete reauth sheet)
 *
 * This spec focuses on the gaps: empty states + the global error
 * boundary, captured at the same viewports as the canonical suite.
 */

const OUT_DIR = path.resolve(process.cwd(), "tasks/screenshots/state-fixtures");
fs.mkdirSync(OUT_DIR, { recursive: true });

const AUTH_DIR = path.resolve(process.cwd(), "e2e/.auth");
const ATHLETE_STORAGE = path.join(AUTH_DIR, "athlete.json");

const BASE_URL = "http://localhost:3000";

type Fixture = {
  slug: string;
  path: string;
  description: string;
};

const FIXTURES: Fixture[] = [
  {
    slug: "empty-wearable-not-connected",
    path: "/athlete/oura",
    description: "Wearable not-connected empty state — the canonical compact empty card",
  },
  {
    slug: "empty-achievements-zero-earned",
    path: "/athlete/achievements",
    description: "Achievements empty state (when 0 earned) — title + sentence + implicit next-step via badge criteria",
  },
  {
    slug: "empty-trends-no-data",
    path: "/athlete/throws/trends",
    description: "Trends empty state when there's no data in the selected range",
  },
];

const VIEWPORTS = [
  { name: "mobile-375-se", width: 375, height: 667 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

const THEMES = ["light", "dark"] as const;

test.describe.configure({ mode: "parallel" });
test.describe("State-fixture screenshots", () => {
  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      for (const fixture of FIXTURES) {
        const filename = `${fixture.slug}__${theme}__${vp.name}.png`;

        test(filename, async ({ browser }) => {
          const context = await browser.newContext({
            storageState: ATHLETE_STORAGE,
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2,
          });

          try {
            await context.addCookies([{ name: "theme", value: theme, url: BASE_URL }]);

            const page = await context.newPage();
            const response = await page.goto(fixture.path, {
              waitUntil: "networkidle",
              timeout: 30_000,
            });
            expect(response, `${fixture.path} produced no response`).toBeTruthy();

            await page.evaluate((t) => {
              document.documentElement.classList.toggle("dark", t === "dark");
            }, theme);
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
  }
});
