import { test, expect } from "@playwright/test";

/**
 * Verifies the coach → athlete data contract: assignments created upstream
 * surface in the athlete's training hub. The seeded athlete1 has 10
 * TrainingSessions (8 completed, 2 scheduled) — fetchTrainingHubData should
 * classify that as "active" state with the "Here's what's on deck" copy.
 *
 * If this breaks, it's one of: (a) fetchTrainingHubData query, (b) state
 * classifier, (c) the TrainingHub client component, (d) athlete-shell auth.
 *
 * Auth comes from the "athlete" project's saved storageState.
 * Gated-by-auth behavior is covered in athlete-auth.spec.ts.
 */
test.describe("Athlete Training Hub", () => {
  test("seeded athlete sees active training state with assigned sessions", async ({ page }) => {
    await page.goto("/athlete/sessions");
    await expect(page.getByRole("heading", { name: "Training" })).toBeVisible();
    // Active state copy — proves at least one scheduled session was found
    // for this athlete. A broken assignments pipeline would flip this to
    // "Welcome to Podium Throws" or "Great work this week".
    await expect(page.getByText("Here's what's on deck")).toBeVisible();
  });
});
