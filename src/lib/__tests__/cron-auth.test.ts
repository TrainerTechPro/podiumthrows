import { describe, it, expect, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import { assertCronAuth, timingSafeEqualStr } from "@/lib/cron-auth";

/** Minimal NextRequest stub — assertCronAuth only reads the authorization header. */
function reqWith(auth: string | null): NextRequest {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === "authorization" ? auth : null) },
  } as unknown as NextRequest;
}

const ORIGINAL = process.env.CRON_SECRET;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

describe("timingSafeEqualStr", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeEqualStr("Bearer abc123", "Bearer abc123")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(timingSafeEqualStr("Bearer abc123", "Bearer abc124")).toBe(false);
  });

  it("returns false for different-length strings without throwing", () => {
    // Plain timingSafeEqual throws on length mismatch; the hash step prevents that.
    expect(timingSafeEqualStr("short", "a-much-longer-secret-value")).toBe(false);
  });
});

describe("assertCronAuth", () => {
  it("fails closed with 500 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = assertCronAuth(reqWith("Bearer anything"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(500);
    expect((await res!.json()).error).toMatch(/not configured/i);
  });

  it("returns 401 when the authorization header is missing", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = assertCronAuth(reqWith(null));
    expect(res!.status).toBe(401);
  });

  it("returns 401 when the bearer token does not match", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = assertCronAuth(reqWith("Bearer wrong"));
    expect(res!.status).toBe(401);
  });

  it("returns null (authorized) when the bearer token matches", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(assertCronAuth(reqWith("Bearer s3cret"))).toBeNull();
  });
});
