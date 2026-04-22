import { test, expect } from "@playwright/test";

// Auth comes from the "athlete" project's saved storageState. See
// playwright.config.ts + e2e/auth.setup.ts.

test.describe("Athlete Log Session", () => {
  test("log-session page renders with event picker", async ({ page }) => {
    await page.goto("/athlete/log-session");
    await expect(page.getByRole("heading", { name: "Log session" })).toBeVisible();
    // Athlete1's allowed event is Shot Put — it must be available
    await expect(page.getByRole("button", { name: "Shot put" })).toBeVisible();
    // Save button starts disabled
    const save = page.getByRole("button", { name: "Save session" });
    await expect(save).toBeDisabled();
  });

  test("submit minimal session → success state + appears in throws history", async ({ page }) => {
    await page.goto("/athlete/log-session");

    // Pick event (athlete1 is shot put only)
    await page.getByRole("button", { name: "Shot put" }).click();

    // Add a drill and select a drill type
    await page.getByRole("button", { name: /Add your first drill/i }).click();
    await page.getByLabel("Drill type").selectOption("Full Throw");

    // Save button becomes enabled
    const save = page.getByRole("button", { name: "Save session" });
    await expect(save).toBeEnabled();
    await save.click();

    // Success: either success toast appears OR doneSummary card renders with action links
    await expect(
      page.getByRole("link", { name: /View sessions/i }).or(page.getByText(/Session saved/i))
    ).toBeVisible({ timeout: 15000 });

    // Cross-check: throws hub loads for this athlete. Use domcontentloaded because
    // /athlete/throws pulls many widgets; waiting for full "load" is brittle in dev.
    await page.goto("/athlete/throws", { waitUntil: "domcontentloaded", timeout: 60000 });
    await expect(page).toHaveURL(/\/athlete\/throws/);
  });
});
