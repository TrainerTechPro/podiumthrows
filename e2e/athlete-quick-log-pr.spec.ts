import { test, expect } from "@playwright/test";
import { loginViaAPI, ATHLETE_1 } from "./helpers/auth";

/**
 * PR detection runs server-side in /api/athlete/quick-log → recordThrow.
 * Testing via the API (not the UI) isolates the regression surface:
 * if this spec breaks, it's the unified PR system, not the celebration UI.
 *
 * Each test generates a UNIQUE implementWeight so we never collide with
 * seed data, prior runs, or parallel workers. recordThrow's legacy
 * fallback will find 0 throws at the unique weight → the first throw
 * becomes the PR baseline.
 */
test.describe("Athlete Quick Log — PR detection", () => {
  test.describe.configure({ mode: "serial" });

  function uniqueWeight(workerIndex: number): number {
    // 5.0–6.0kg band (no athlete1 seed data there, outside competition weights).
    // Two decimal places so the PR label stays legible.
    const rand = Math.floor(Math.random() * 10000);
    const offset = (workerIndex * 1000 + rand) / 100000;
    return parseFloat((5.0 + offset).toFixed(4));
  }

  async function postThrow(
    context: import("@playwright/test").BrowserContext,
    baseURL: string,
    implementWeight: number,
    distance: number
  ) {
    const cookies = await context.cookies();
    const csrfToken = cookies.find((c) => c.name === "csrf-token")?.value ?? "";
    return context.request.post(`${baseURL}/api/athlete/quick-log`, {
      data: { event: "SHOT_PUT", implementWeight, distance },
      headers: { "X-CSRF-Token": csrfToken },
    });
  }

  test("first throw at a fresh implement weight is flagged as PR", async ({
    context,
    baseURL,
  }, testInfo) => {
    expect(baseURL).toBeTruthy();
    await loginViaAPI(context, baseURL!, ATHLETE_1.email, ATHLETE_1.password);

    const weight = uniqueWeight(testInfo.workerIndex);
    const res = await postThrow(context, baseURL!, weight, 22.0);
    expect(res.status(), await res.text()).toBe(200);

    const body = await res.json();
    console.log("[PR test] weight=%s body=%s", weight, JSON.stringify(body));
    expect(body.success).toBe(true);
    expect(body.data.throw.distance).toBe(22.0);
    expect(body.data.throw.isPersonalBest).toBe(true);
  });

  test("subsequent smaller throw is NOT a PR", async ({ context, baseURL }, testInfo) => {
    expect(baseURL).toBeTruthy();
    await loginViaAPI(context, baseURL!, ATHLETE_1.email, ATHLETE_1.password);

    const weight = uniqueWeight(testInfo.workerIndex);

    // First throw establishes the baseline
    const r1 = await postThrow(context, baseURL!, weight, 30.0);
    expect(r1.status()).toBe(200);
    expect((await r1.json()).data.throw.isPersonalBest).toBe(true);

    // Second throw at same weight, lower distance → not a PR
    const r2 = await postThrow(context, baseURL!, weight, 10.0);
    expect(r2.status()).toBe(200);
    const body = await r2.json();
    expect(body.data.throw.distance).toBe(10.0);
    expect(body.data.throw.isPersonalBest).toBe(false);
  });
});
