import { test, expect } from "@playwright/test";
import { getAthleteIdByEmail } from "./helpers/db";
import { ensureThrowsAssignmentForAthlete1 } from "./helpers/seed-e2e";

/**
 * Coach side has a single legacy → canonical mapping today:
 *   /coach/athletes/:athleteId/sessions/:id  →  /coach/throws/:id?athlete=:athleteId
 *
 * Keeping this in its own file (instead of bundling with the athlete spec)
 * so the coach auth project can target it independently.
 */

test.describe("Coach session/throws legacy URL redirects", () => {
  test("/coach/athletes/:athleteId/sessions/:id redirects to /coach/throws with ?athlete=", async ({
    page,
  }) => {
    const athleteId = getAthleteIdByEmail("athlete1@example.com");
    const { throwsAssignmentId } = ensureThrowsAssignmentForAthlete1();

    await page.goto(`/coach/athletes/${athleteId}/sessions/${throwsAssignmentId}`);
    await page.waitForURL(/\/coach\/throws\//, { timeout: 10_000 });

    const landed = new URL(page.url());
    expect(landed.pathname).toBe(`/coach/throws/${throwsAssignmentId}`);
    expect(landed.searchParams.get("athlete")).toBe(athleteId);
  });
});
