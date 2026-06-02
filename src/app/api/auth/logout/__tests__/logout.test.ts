import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  getSession: vi.fn().mockResolvedValue(null),
  blacklistToken: vi.fn().mockResolvedValue(undefined),
  cookieStoreGet: vi.fn().mockReturnValue(undefined),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mocks.rateLimit(...args),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getSession: (...args: unknown[]) => mocks.getSession(...args),
  };
});

vi.mock("@/lib/token-blacklist", () => ({
  blacklistToken: (...args: unknown[]) => mocks.blacklistToken(...args),
}));

const logAuditMock = vi.fn();
vi.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => logAuditMock(...args),
  auditRequestInfo: vi.fn().mockReturnValue({ ip: "1.2.3.4", userAgent: "test" }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: (name: string) => mocks.cookieStoreGet(name) })),
}));

import { POST } from "../route";

function makeRequest(ip = "1.2.3.4"): NextRequest {
  return new NextRequest("http://test/api/auth/logout", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

// Helper: simulate the in-memory rate-limit counter so the 11th request trips.
function simulateRateLimit(maxAttempts: number) {
  let count = 0;
  mocks.rateLimit.mockImplementation(async () => {
    count++;
    if (count <= maxAttempts) {
      return { success: true, remaining: maxAttempts - count, retryAfter: 0 };
    }
    return { success: false, remaining: 0, retryAfter: 42_000 };
  });
}

describe("POST /api/auth/logout — rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(null);
    mocks.cookieStoreGet.mockReturnValue(undefined);
  });

  it("allows the first 10 requests and rejects the 11th with 429", async () => {
    simulateRateLimit(10);

    // First 10 succeed.
    for (let i = 0; i < 10; i++) {
      const res = await POST(makeRequest());
      expect(res.status).toBe(200);
    }

    // 11th trips the limit.
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: "Too many logout requests" });
    expect(res.headers.get("Retry-After")).toBe("42");

    // rateLimit was called with the right key + options on every request.
    expect(mocks.rateLimit).toHaveBeenCalledTimes(11);
    for (const call of mocks.rateLimit.mock.calls) {
      expect(call[0]).toBe("logout:1.2.3.4");
      expect(call[1]).toEqual({ maxAttempts: 10, windowMs: 60_000 });
    }
  });

  it("uses a distinct key namespace so it doesn't starve login/register", async () => {
    simulateRateLimit(10);
    await POST(makeRequest());
    const key = mocks.rateLimit.mock.calls[0][0] as string;
    expect(key.startsWith("logout:")).toBe(true);
    expect(key.startsWith("login:")).toBe(false);
    expect(key.startsWith("register:")).toBe(false);
  });

  it("keys by IP so different IPs have independent budgets", async () => {
    simulateRateLimit(10);
    await POST(makeRequest("10.0.0.1"));
    await POST(makeRequest("10.0.0.2"));
    const [firstKey, secondKey] = mocks.rateLimit.mock.calls.map((c) => c[0]);
    expect(firstKey).toBe("logout:10.0.0.1");
    expect(secondKey).toBe("logout:10.0.0.2");
  });

  it("rate-limit rejection does NOT blacklist the token", async () => {
    // First request succeeds, second is rate-limited.
    simulateRateLimit(1);
    mocks.cookieStoreGet.mockReturnValue("fake.jwt.value");

    await POST(makeRequest()); // burns the budget
    mocks.blacklistToken.mockClear();

    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    // Critical: the 429 path must not touch the DoS'able DB table.
    expect(mocks.blacklistToken).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/logout — token invalidation surfacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simulateRateLimit(10);
    mocks.getSession.mockResolvedValue(null);
    // Route reads cookieStore.get("auth-token")?.value — return a cookie-shaped object.
    mocks.cookieStoreGet.mockReturnValue({ value: "fake.jwt.value" });
    mocks.blacklistToken.mockResolvedValue(undefined);
  });

  function cookieHeader(res: Awaited<ReturnType<typeof POST>>): string {
    // NextResponse appends multiple Set-Cookie headers; getSetCookie joins them.
    return res.headers.getSetCookie?.().join("; ") ?? res.headers.get("set-cookie") ?? "";
  }

  it("returns 200 success and clears cookies when blacklisting succeeds", async () => {
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mocks.blacklistToken).toHaveBeenCalledTimes(1);
    expect(cookieHeader(res)).toContain("auth-token=;");
  });

  it("surfaces a 500 (not a masked success) when blacklisting fails after retry", async () => {
    mocks.blacklistToken.mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/couldn’t fully revoke/i);
    // Retried once before giving up.
    expect(mocks.blacklistToken).toHaveBeenCalledTimes(2);
  });

  it("still clears the auth + csrf cookies even when blacklisting fails", async () => {
    mocks.blacklistToken.mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest());

    const cookies = cookieHeader(res);
    expect(cookies).toContain("auth-token=;");
    expect(res.status).toBe(500);
  });

  it("retries once and succeeds on the second attempt (transient blip)", async () => {
    mocks.blacklistToken
      .mockRejectedValueOnce(new Error("pool timeout"))
      .mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mocks.blacklistToken).toHaveBeenCalledTimes(2);
  });

  it("records tokenInvalidated:false in the audit log when invalidation fails", async () => {
    mocks.getSession.mockResolvedValue({ userId: "u1", email: "a@b.c", role: "ATHLETE" });
    mocks.blacklistToken.mockRejectedValue(new Error("db down"));

    await POST(makeRequest());

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        action: "LOGOUT",
        metadata: { tokenInvalidated: false },
      })
    );
  });

  it("does NOT add the failure flag to the audit log on success", async () => {
    mocks.getSession.mockResolvedValue({ userId: "u1", email: "a@b.c", role: "ATHLETE" });

    await POST(makeRequest());

    const entry = logAuditMock.mock.calls[0][0];
    expect(entry).toMatchObject({ userId: "u1", action: "LOGOUT" });
    expect(entry).not.toHaveProperty("metadata");
  });

  it("treats a session with no auth-token cookie as fully invalidated", async () => {
    mocks.cookieStoreGet.mockReturnValue(undefined);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mocks.blacklistToken).not.toHaveBeenCalled();
  });
});
