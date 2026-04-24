import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockUserFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}));

const mockRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

const mockVerifyMfaSessionToken = vi.fn();
const mockVerifyTotpToken = vi.fn();
vi.mock("@/lib/mfa", () => ({
  verifyMfaSessionToken: (...args: unknown[]) => mockVerifyMfaSessionToken(...args),
  verifyTotpToken: (...args: unknown[]) => mockVerifyTotpToken(...args),
}));

const mockBlacklistToken = vi.fn();
const mockIsBlacklisted = vi.fn();
vi.mock("@/lib/token-blacklist", () => ({
  blacklistToken: (...args: unknown[]) => mockBlacklistToken(...args),
  isBlacklisted: (...args: unknown[]) => mockIsBlacklisted(...args),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
  auditRequestInfo: vi.fn().mockReturnValue({ ip: "127.0.0.1", userAgent: "test" }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { POST as verifyPOST } from "../verify/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/mfa/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

const VALID_TOKEN = "mfa-session-token-abc";
const VALID_TOTP = "123456";

function seedHappyPath() {
  mockRateLimit.mockResolvedValue({ success: true, remaining: 4, retryAfter: 0 });
  mockVerifyMfaSessionToken.mockReturnValue({ userId: "user-1" });
  mockUserFindUnique.mockResolvedValue({
    id: "user-1",
    email: "coach@example.com",
    role: "COACH",
    isAdmin: false,
    coachProfile: { mfaSecret: "enc-secret", mfaEnabled: true },
  });
  mockVerifyTotpToken.mockReturnValue(true);
  mockBlacklistToken.mockResolvedValue(undefined);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/auth/mfa/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consumes the mfaSessionToken on success so replays are rejected", async () => {
    // First call — token is not yet blacklisted; verify succeeds.
    seedHappyPath();
    mockIsBlacklisted.mockResolvedValueOnce(false);

    const firstRes = await verifyPOST(
      makeRequest({ mfaSessionToken: VALID_TOKEN, token: VALID_TOTP })
    );
    expect(firstRes.status).toBe(200);

    // Route must have blacklisted the token with the exact raw value it received.
    expect(mockBlacklistToken).toHaveBeenCalledTimes(1);
    expect(mockBlacklistToken).toHaveBeenCalledWith(VALID_TOKEN);

    // Auth cookie was issued.
    const setCookies = firstRes.headers.getSetCookie();
    expect(setCookies.some((c) => c.startsWith("auth-token="))).toBe(true);

    // Second call with the same token — blacklist now reports true; must 401.
    seedHappyPath();
    mockIsBlacklisted.mockResolvedValueOnce(true);

    const secondRes = await verifyPOST(
      makeRequest({ mfaSessionToken: VALID_TOKEN, token: VALID_TOTP })
    );
    expect(secondRes.status).toBe(401);
    const json = await secondRes.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("MFA session expired. Please log in again.");

    // Critical: the route must short-circuit before re-blacklisting or issuing a cookie.
    expect(mockBlacklistToken).toHaveBeenCalledTimes(1);
    const secondCookies = secondRes.headers.getSetCookie();
    expect(secondCookies.some((c) => c.startsWith("auth-token="))).toBe(false);
  });
});
