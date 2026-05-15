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

  test("athlete detail renders the canonical scroll sections", async ({ page }) => {
    await page.goto("/coach/athletes");
    const jordanRow = page.getByRole("button").filter({ hasText: "Jordan Mitchell" }).first();
    await jordanRow.click();
    await page.waitForURL(/\/coach\/athletes\/[^/]+/, { timeout: 15000 });

    // The unified scroll page absorbs the former Throws Profile jobs.
    // Each section anchor must render — they're how coaches reach
    // Bondarchuk type, throws data, performance tests, readiness.
    for (const id of [
      "overview",
      "training",
      "throws",
      "performance",
      "readiness",
      "wellness",
      "goals",
    ]) {
      await expect(page.locator(`section#${id}`)).toBeVisible();
    }
  });

  test("/coach/athletes/:id/profile redirects to the canonical detail page", async ({ page }) => {
    // The sub-route was a redirect-shell pointing into the retired
    // /coach/throws/profile. After the MVP surface cut it lands on the
    // unified /coach/athletes/:id page instead. Use the row to discover
    // a real seeded athlete id, then hit /profile directly.
    await page.goto("/coach/athletes");
    const jordanRow = page.getByRole("button").filter({ hasText: "Jordan Mitchell" }).first();
    await jordanRow.click();
    await page.waitForURL(/\/coach\/athletes\/[^/]+/, { timeout: 15000 });
    const url = new URL(page.url());
    const athleteId = url.pathname.split("/").pop()!;

    await page.goto(`/coach/athletes/${athleteId}/profile`);
    await expect(page).toHaveURL(`/coach/athletes/${athleteId}`);
    await expect(page.locator("section#overview")).toBeVisible();
  });
});
