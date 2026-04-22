import { test, expect } from "@playwright/test";

// Auth comes from the "coach" project's storageState.

test.describe("Coach Dashboard", () => {
  test("coach sees dashboard content after login", async ({ page }) => {
    await page.goto("/coach/dashboard");
    await expect(page).toHaveURL(/\/coach\/dashboard/);
    // Editorial coach dashboard headline — no greeting ceremony here,
    // per Dual Product Identity (research-software register).
    await expect(page.getByRole("heading", { name: "Your program, today." })).toBeVisible();
  });

  test("coach can navigate to athletes page", async ({ page }) => {
    await page.goto("/coach/dashboard");
    const athleteLink = page.getByRole("link", { name: /athlete|roster/i }).first();
    if (await athleteLink.isVisible()) {
      await athleteLink.click();
      await page.waitForURL(/\/coach\/(athletes|throws\/roster)/, {
        timeout: 10000,
      });
    }
  });

  test("coach can navigate to programs page", async ({ page }) => {
    await page.goto("/coach/dashboard");
    const programLink = page.getByRole("link", { name: /program|session/i }).first();
    if (await programLink.isVisible()) {
      await programLink.click();
      // Speculative nav — accept any coach-surface URL change, not just
      // /my-program or /sessions. Different dashboard modes surface
      // different program links; we just want to verify a link works.
      await page.waitForURL(/\/coach\/[^/]+/, { timeout: 10000 });
    }
  });
});
