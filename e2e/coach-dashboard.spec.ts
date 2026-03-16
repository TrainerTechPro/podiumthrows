import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Coach Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("coach sees dashboard content after login", async ({ page }) => {
    await expect(page).toHaveURL(/\/coach\/dashboard/);
    // Should show a time-based greeting
    await expect(page.locator("body")).toContainText(/Good (morning|afternoon|evening)/);
  });

  test("coach can navigate to athletes page", async ({ page }) => {
    const athleteLink = page.getByRole("link", { name: /athlete|roster/i }).first();
    if (await athleteLink.isVisible()) {
      await athleteLink.click();
      await page.waitForURL(/\/coach\/(athletes|throws\/roster)/, {
        timeout: 10000,
      });
    }
  });

  test("coach can navigate to programs page", async ({ page }) => {
    // Look for a programs/sessions link in the sidebar or nav
    const programLink = page.getByRole("link", { name: /program|session/i }).first();
    if (await programLink.isVisible()) {
      await programLink.click();
      await page.waitForURL(/\/coach\/(my-program|sessions)/, {
        timeout: 10000,
      });
    }
  });
});
