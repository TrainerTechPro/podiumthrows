import { test, expect } from "@playwright/test";

/**
 * Contract test for the PR 6 coach-IA consolidation 308 redirects.
 *
 * Same pattern as route-consolidation-redirects.spec.ts (PR 1's 307 contract).
 * These rows are static config-level redirects — they fire before middleware
 * and before any page render, so we exercise them with raw HTTP via the
 * `request` fixture, no browser, no auth.
 *
 * If a future commit changes the IA again, append/edit rows here and at the
 * source in next.config.mjs. This spec is the rollback fence: any commit
 * that breaks a PR 6 redirect fails here before reaching prod.
 *
 * 308 (vs PR 1's 307): these are real IA migrations; the destinations are
 * the canonical home for the content, not a transitional one. Browsers
 * cache the decision aggressively — by design.
 */

type RedirectCase = {
  source: string;
  destination: string;
};

const REDIRECTS: RedirectCase[] = [
  // Calendar absorbs schedule, practices (list), availability, live-practice (list).
  { source: "/coach/schedule", destination: "/coach/calendar" },
  { source: "/coach/practices", destination: "/coach/calendar?view=by-athlete" },
  { source: "/coach/availability", destination: "/coach/calendar?view=compliance" },
  { source: "/coach/throws/practice", destination: "/coach/calendar?view=live" },

  // Library absorbs exercises, throws-library (sessions), throws-drills,
  // plans (list). Drill videos collapse into Library/Drills.
  { source: "/coach/exercises", destination: "/coach/library?view=exercises" },
  { source: "/coach/throws/library", destination: "/coach/library?view=sessions" },
  { source: "/coach/throws/drills", destination: "/coach/library?view=drills" },
  { source: "/coach/plans", destination: "/coach/library?view=plans" },
  { source: "/coach/videos/drills", destination: "/coach/library?view=drills" },

  // Builder absorbs throws-builder, plan-new, plan-generate.
  { source: "/coach/throws/builder", destination: "/coach/builder?type=session" },
  { source: "/coach/plans/new", destination: "/coach/builder?type=plan" },
  {
    source: "/coach/plans/generate",
    destination: "/coach/builder?type=plan&mode=generate",
  },

  // Athletes Tier-2 sibling renames.
  { source: "/coach/teams", destination: "/coach/athletes/groups" },
  { source: "/coach/event-groups", destination: "/coach/athletes/event-groups" },
  { source: "/coach/goals", destination: "/coach/athletes/goals" },
  { source: "/coach/competitions", destination: "/coach/athletes/competitions" },
  { source: "/coach/team", destination: "/coach/athletes/announcements" },

  // Athletes Tier-1 self-logs tab.
  { source: "/coach/athlete-logs", destination: "/coach/athletes?tab=self-logs" },

  // Killed / contextual.
  { source: "/coach/throws", destination: "/coach/dashboard" },
  { source: "/coach/log-session", destination: "/coach/calendar" },
  { source: "/coach/wellness", destination: "/coach/dashboard?tab=readiness" },
  { source: "/coach/hub", destination: "/coach/dashboard" },

  // Settings tabs.
  { source: "/coach/tools", destination: "/coach/settings?tab=integrations" },
  { source: "/coach/integrations", destination: "/coach/settings?tab=integrations" },

  // Throws Analyze + Video merges into Video Analysis.
  { source: "/coach/throws/analyze", destination: "/coach/video-analysis?event=throws" },
  { source: "/coach/throws/analyze/history", destination: "/coach/video-analysis?tab=history" },
  { source: "/coach/videos", destination: "/coach/video-analysis" },
  { source: "/coach/videos/upload", destination: "/coach/video-analysis/upload" },
];

test.describe("PR 6 coach-IA consolidation 308 redirects", () => {
  for (const { source, destination } of REDIRECTS) {
    test(`${source} → ${destination}`, async ({ request }) => {
      const response = await request.get(source, { maxRedirects: 0 });
      expect(response.status(), `${source} should return 308, got ${response.status()}`).toBe(308);
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

/**
 * Parametrized redirects (path/query templates with variable segments).
 * These need fresh test data — sample IDs are arbitrary, the redirect
 * just needs to substitute them into the destination correctly.
 */
test.describe("PR 6 parametrized redirects", () => {
  test("/coach/throws/assessment/:athleteId → /coach/athletes/:athleteId/assessments", async ({
    request,
  }) => {
    const sampleId = "sample-athlete-id-abc123";
    const response = await request.get(`/coach/throws/assessment/${sampleId}`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(308);
    const location = response.headers()["location"];
    expect(location).toBeTruthy();
    expect(location.endsWith(`/coach/athletes/${sampleId}/assessments`)).toBe(true);
  });

  test("/coach/throws/analyze/:id → /coach/video-analysis/:id", async ({ request }) => {
    const sampleId = "sample-analysis-id-xyz789";
    const response = await request.get(`/coach/throws/analyze/${sampleId}`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(308);
    const location = response.headers()["location"];
    expect(location).toBeTruthy();
    expect(location.endsWith(`/coach/video-analysis/${sampleId}`)).toBe(true);
  });

  test("/coach/videos/:id → /coach/video-analysis/:id", async ({ request }) => {
    const sampleId = "sample-video-id-def456";
    const response = await request.get(`/coach/videos/${sampleId}`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(308);
    const location = response.headers()["location"];
    expect(location).toBeTruthy();
    expect(location.endsWith(`/coach/video-analysis/${sampleId}`)).toBe(true);
  });
});

/**
 * Documented non-redirects — surfaces that were considered for redirect
 * but intentionally left live, with reasons. If any of these gain a
 * redirect later, the assertion here flips and the spec catches it.
 */
test.describe("PR 6 intentional non-redirects", () => {
  test("/coach/throws/profile stays live (3334-line component, extraction deferred)", async ({
    request,
  }) => {
    const response = await request.get("/coach/throws/profile", {
      maxRedirects: 0,
    });
    // Auth-gated; expect either 200 (rendered) or 307 to /login (unauth) — but
    // NOT 308 (which would mean a redirect from the IA migration accidentally
    // landed). Anything but 308 means the route is still serving content.
    expect(response.status(), "must not be a 308 IA-migration redirect").not.toBe(308);
  });

  test("/coach/throws/invite stays live (throw-profile invite CTA migration deferred)", async ({
    request,
  }) => {
    const response = await request.get("/coach/throws/invite", {
      maxRedirects: 0,
    });
    expect(response.status(), "must not be a 308 IA-migration redirect").not.toBe(308);
  });
});
