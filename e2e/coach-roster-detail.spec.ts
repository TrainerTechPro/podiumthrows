import { test, expect } from "@playwright/test";

/**
 * Coach daily-use path: dashboard → roster → open an athlete's detail.
 * The seeded coach has 4 athletes; Jordan Mitchell is athlete1.
 * Auth comes from the "coach" project's saved storageState.
 */
test.describe("Coach Roster → Athlete Detail", () => {
  test("roster lists seeded athletes", async ({ page }) => {
    await page.goto("/coach/athletes");
    await expect(page).toHaveURL(/\/coach\/athletes/);
    await expect(page.getByRole("heading", { name: "Athletes" })).toBeVisible();
    await expect(page.getByText("Jordan Mitchell").first()).toBeVisible();
  });

  test("clicking an athlete opens their detail page", async ({ page }) => {
    await page.goto("/coach/athletes");
    // Row is a role="button" clickable cell (DataTable onRowClick), not a link.
    const jordanRow = page.getByRole("button").filter({ hasText: "Jordan Mitchell" }).first();
    await jordanRow.click();
    await page.waitForURL(/\/coach\/athletes\/[^/]+/, { timeout: 15000 });
    await expect(page.locator("body")).toContainText("Jordan");
  });
});
