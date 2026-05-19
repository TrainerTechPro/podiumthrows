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
    // Status-aware header (post status-aware Training refactor, commit 9df3f78):
    // "active" data → status pill of "In progress" or "Due today" plus an h1
    // titled "<n> sessions today" (or the single session's name). The "cold-start"
    // / "between" / "Rest day" copy would flip these, so this is what proves the
    // assignments pipeline produced today's sessions.
    await expect(page.getByText(/^(In progress|Due today)$/).first()).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: /sessions today|Quick Log|Session/i })
    ).toBeVisible();
    // The hub itself renders today's workouts list — proves TrainingHub mounted.
    await expect(page.getByRole("heading", { name: "Today's Workouts" })).toBeVisible();
  });
});
