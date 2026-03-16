// src/lib/__tests__/rate-limit.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

// Reset module between tests so InMemoryStore is fresh
let rateLimit: typeof import("../rate-limit").rateLimit;

beforeEach(async () => {
  // Clear env vars BEFORE resetting modules so the fresh module sees no Upstash config
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  vi.resetModules();
  const mod = await import("../rate-limit");
  rateLimit = mod.rateLimit;
});

describe("rateLimit (in-memory fallback)", () => {
  it("allows requests under the limit", async () => {
    const result = await rateLimit("test:allow", { maxAttempts: 3, windowMs: 60_000 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.retryAfter).toBe(0);
  });

  it("counts down remaining correctly", async () => {
    const opts = { maxAttempts: 3, windowMs: 60_000 };
    const r1 = await rateLimit("test:countdown", opts);
    expect(r1.remaining).toBe(2);

    const r2 = await rateLimit("test:countdown", opts);
    expect(r2.remaining).toBe(1);

    const r3 = await rateLimit("test:countdown", opts);
    expect(r3.remaining).toBe(0);
    expect(r3.success).toBe(true);
  });

  it("blocks when limit is exceeded", async () => {
    const opts = { maxAttempts: 2, windowMs: 60_000 };
    await rateLimit("test:block", opts);
    await rateLimit("test:block", opts);

    const blocked = await rateLimit("test:block", opts);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("isolates different identifiers", async () => {
    const opts = { maxAttempts: 1, windowMs: 60_000 };
    await rateLimit("test:iso-a", opts);

    const result = await rateLimit("test:iso-b", opts);
    expect(result.success).toBe(true);
  });

  it("resets after window expires", async () => {
    vi.useFakeTimers();
    const opts = { maxAttempts: 1, windowMs: 1_000 };

    await rateLimit("test:expire", opts);
    const blocked = await rateLimit("test:expire", opts);
    expect(blocked.success).toBe(false);

    vi.advanceTimersByTime(1_001);

    const reset = await rateLimit("test:expire", opts);
    expect(reset.success).toBe(true);

    vi.useRealTimers();
  });
});
