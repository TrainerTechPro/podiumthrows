import { test, expect } from "@playwright/test";
import { ATHLETE_1 } from "./helpers/auth";
import {
  getAthleteIdByEmail,
  upsertThrowsPR,
  deleteThrowsPR,
  deleteThrowLogsInWindow,
} from "./helpers/db";

// Auth comes from the "athlete" project's storageState — no explicit login
// per test, which avoids the upstash rate limiter on /api/auth/login.

/**
 * PR detection runs server-side in /api/athlete/quick-log → recordThrow.
 * We pre-populate a ThrowsPR baseline so recordThrow takes the fast path
 * (existing PR in the unified table, no legacy ThrowLog scan). That is the
 * invariant the unified PR system guarantees: once a ThrowsPR row exists,
 * new throws either exceed it (→ PR) or don't (→ not PR).
 *
 * Tests are serial so the throws + ThrowsPR state is deterministic.
 * Each test sets its baseline in beforeEach and cleans up in afterEach.
 */
test.describe("Athlete Quick Log — PR detection", () => {
  test.describe.configure({ mode: "serial" });

  // Use shot put heavy implement (9kg) — seed has throws there but distances
  // top out at ~16.5m, so a 25m baseline clearly dominates and my test
  // distances are in a range the PR logic can evaluate unambiguously.
  const EVENT = "SHOT_PUT";
  const IMPL_KG = 9.0;

  let athleteId: string;

  test.beforeAll(() => {
    athleteId = getAthleteIdByEmail(ATHLETE_1.email);
  });

  test.beforeEach(() => {
    // Seed a 25m baseline PR. Any test throw > 25m is a PR; ≤ 25m isn't.
    upsertThrowsPR({ athleteId, event: EVENT, implementKg: IMPL_KG, distance: 25.0 });
  });

  test.afterEach(() => {
    deleteThrowLogsInWindow({
      athleteId,
      event: EVENT,
      implementKg: IMPL_KG,
      sinceMinutes: 5,
    });
    deleteThrowsPR({ athleteId, event: EVENT, implementKg: IMPL_KG });
  });

  async function postThrow(
    page: import("@playwright/test").Page,
    baseURL: string,
    distance: number
  ) {
    // CSRF cookie is in storageState; refresh it with a cheap page hit
    // so we always read the current value.
    await page.goto("/athlete/dashboard", { waitUntil: "commit" });
    const cookies = await page.context().cookies();
    const csrfToken = cookies.find((c) => c.name === "csrf-token")?.value ?? "";
    return page.request.post(`${baseURL}/api/athlete/quick-log`, {
      data: { event: EVENT, implementWeight: IMPL_KG, distance },
      headers: { "X-CSRF-Token": csrfToken },
    });
  }

  test("throw above existing PR is flagged", async ({ page, baseURL }) => {
    const res = await postThrow(page, baseURL!, 28.0);
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.throw.distance).toBe(28.0);
    expect(body.data.throw.isPersonalBest).toBe(true);
  });

  test("throw below existing PR is not flagged", async ({ page, baseURL }) => {
    const res = await postThrow(page, baseURL!, 15.0);
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.throw.distance).toBe(15.0);
    expect(body.data.throw.isPersonalBest).toBe(false);
  });
});
