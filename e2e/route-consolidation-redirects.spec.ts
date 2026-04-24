import { test, expect } from "@playwright/test";

/**
 * Contract test for the PR 1 route-consolidation 307s.
 *
 * These are static, config-level redirects (no DB seed, no auth) — they
 * fire before middleware and before any page render, so we test them
 * with raw HTTP via the `request` fixture. That keeps the spec fast
 * (<1s per redirect) and insulates it from the auth-gated browser flow
 * that the session-redirects specs need.
 *
 * Each row below is one redirect added to next.config.mjs. If we add a
 * new route-consolidation 307 in a later commit, append a row here.
 * If we pull one (e.g., Commit 5 decides /athlete/quick-start is live),
 * remove that row.
 *
 * This test is the rollback fence for PR 1 AND for PR 2 — any future
 * commit that breaks a redirect fails here before it reaches prod.
 */

type RedirectCase = {
  source: string;
  destination: string;
};

const REDIRECTS: RedirectCase[] = [
  // Page-level redirect stubs promoted to config.
  { source: "/athlete/hub", destination: "/athlete/dashboard" },
  { source: "/coach/my-program", destination: "/athlete/dashboard" },
  { source: "/coach/my-training", destination: "/athlete/dashboard" },
  { source: "/coach/my-lifting", destination: "/athlete/dashboard" },
  { source: "/coach/drill-videos", destination: "/coach/throws/drills" },
  { source: "/coach/invitations", destination: "/coach/athletes/invitations" },

  // Near-dead consumer-log URL.
  { source: "/athlete/throws/log", destination: "/athlete/log-session" },

  // Staged ahead of Commit 5 validation.
  { source: "/athlete/quick-start", destination: "/athlete/log-session" },

  // Exercise recommender subsumed by /coach/plans/generate.
  { source: "/coach/throws/programming", destination: "/coach/plans/generate" },
];

test.describe("PR 1 route-consolidation 307 redirects", () => {
  for (const { source, destination } of REDIRECTS) {
    test(`${source} → ${destination}`, async ({ request }) => {
      const response = await request.get(source, { maxRedirects: 0 });
      expect(response.status(), `${source} should return 307, got ${response.status()}`).toBe(307);
      const location = response.headers()["location"];
      expect(location, `${source} should set Location header`).toBeTruthy();
      // Next.js emits Location as an absolute or relative URL depending on
      // the deployment — assert on the path ending so either form passes.
      expect(
        location.endsWith(destination),
        `${source} should redirect to ${destination}, got ${location}`
      ).toBe(true);
    });
  }
});
