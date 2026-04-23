import { test, expect } from "@playwright/test";
import {
  ensureThrowsAssignmentForAthlete1,
  getCompletedTrainingSessionIdForAthlete1,
} from "./helpers/seed-e2e";

/**
 * Legacy → canonical URL contract for the athlete shell.
 *
 * Each legacy path is a permanent redirect in next.config.mjs. The
 * canonical /athlete/session/[id] and /athlete/throws/[id] pages further
 * normalize bare URLs by appending ?view=live|recap based on status.
 *
 * We hit five legacy athlete-side URLs and assert the browser lands on
 * the canonical path with the expected ?view= query. Both levels of
 * routing (config redirects + in-page status-based view dispatch) are
 * covered by the final URL assertion.
 */

// Wait for the URL to carry a concrete ?view=, since two redirects chain
// (config-level + server-component) and the intermediate URL briefly
// matches `/athlete/throws/` without a view query.
async function gotoAndWaitForView(
  page: import("@playwright/test").Page,
  from: string,
  expectedPathname: string,
  expectedView: "live" | "recap"
) {
  await page.goto(from);
  await page.waitForURL((url) => url.searchParams.get("view") === expectedView, {
    timeout: 10_000,
  });
  const landed = new URL(page.url());
  expect(landed.pathname).toBe(expectedPathname);
  expect(landed.searchParams.get("view")).toBe(expectedView);
}

test.describe("Athlete session/throws legacy URL redirects", () => {
  test("five legacy athlete URLs resolve to their canonical equivalents", async ({ page }) => {
    const trainingSessionId = getCompletedTrainingSessionIdForAthlete1();
    const { throwsAssignmentId } = ensureThrowsAssignmentForAthlete1();

    // 1. /athlete/sessions/:id → /athlete/session/:id (COMPLETED → ?view=recap)
    await gotoAndWaitForView(
      page,
      `/athlete/sessions/${trainingSessionId}`,
      `/athlete/session/${trainingSessionId}`,
      "recap"
    );

    // 2. /athlete/sessions/:id/recap → /athlete/session/:id?view=recap
    await gotoAndWaitForView(
      page,
      `/athlete/sessions/${trainingSessionId}/recap`,
      `/athlete/session/${trainingSessionId}`,
      "recap"
    );

    // 3. /athlete/sessions/assignment/:id → /athlete/throws/:id (ASSIGNED → ?view=live)
    await gotoAndWaitForView(
      page,
      `/athlete/sessions/assignment/${throwsAssignmentId}`,
      `/athlete/throws/${throwsAssignmentId}`,
      "live"
    );

    // 4. /athlete/throws/session/:id → /athlete/throws/:id
    await gotoAndWaitForView(
      page,
      `/athlete/throws/session/${throwsAssignmentId}`,
      `/athlete/throws/${throwsAssignmentId}`,
      "live"
    );

    // 5. /athlete/throws/live/:id → /athlete/throws/:id?view=live
    await gotoAndWaitForView(
      page,
      `/athlete/throws/live/${throwsAssignmentId}`,
      `/athlete/throws/${throwsAssignmentId}`,
      "live"
    );
  });
});
