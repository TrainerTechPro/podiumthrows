import { test, expect } from "@playwright/test";

/**
 * Contract test for the PR 7 athlete-onboarding consolidation redirects.
 *
 * Same shape as the PR 6 coach-IA contract — raw HTTP via the `request`
 * fixture, no browser, no auth. The redirects fire before middleware so
 * they're testable with a single HEAD/GET per row.
 *
 * If a future commit changes the onboarding IA, append/edit rows here and
 * at the source in next.config.mjs. This spec is the rollback fence.
 */

type RedirectCase = {
  source: string;
  destination: string;
};

const REDIRECTS: RedirectCase[] = [
  // /athlete/review-profile retired — invite-flow athletes (claimed via coach
  // proxy) now land in the unified onboarding wizard's invite mode (3 visible
  // steps, prefilled from coach data, jumps to the first-throw log).
  {
    source: "/athlete/review-profile",
    destination: "/athlete/onboarding?from=invite",
  },
];

test.describe("PR 7 athlete-onboarding consolidation 308 redirects", () => {
  for (const { source, destination } of REDIRECTS) {
    test(`${source} → ${destination}`, async ({ request }) => {
      const response = await request.get(source, { maxRedirects: 0 });
      expect(response.status(), `${source} should return 308, got ${response.status()}`).toBe(308);
      const location = response.headers()["location"];
      expect(location, `${source} should set Location header`).toBeTruthy();
      expect(
        location.endsWith(destination),
        `${source} should redirect to ${destination}, got ${location}`
      ).toBe(true);
    });
  }
});

/**
 * Documented non-redirect: /athlete/quick-start stays live.
 *
 * It's the smart-routing target for the QuickActions "Start Session" FAB,
 * NOT an onboarding route. Priority chain: resume in-progress workout →
 * next self-program session → pending coach assignment → ad-hoc log
 * fallback. Folding into /athlete/onboarding would break the daily-use
 * Start Session flow for every coach-managed athlete.
 *
 * If this assertion ever flips and quick-start gains a 308, the spec
 * catches it before it reaches prod.
 */
test.describe("PR 7 intentional non-redirects", () => {
  test("/athlete/quick-start stays live (Start Session smart-router, NOT onboarding)", async ({
    request,
  }) => {
    const response = await request.get("/athlete/quick-start", {
      maxRedirects: 0,
    });
    expect(response.status(), "must not be a 308 IA-migration redirect").not.toBe(308);
  });
});
