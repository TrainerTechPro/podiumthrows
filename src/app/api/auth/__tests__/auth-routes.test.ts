import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

// Prisma
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockCount = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    athleteProfile: {
      create: vi.fn(),
      count: (...args: unknown[]) => mockCount(...args),
    },
    coachProfile: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    invitation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

// Rate limiting
const mockRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

// Auth helpers — mock bcrypt-based functions, keep signToken/cookie helpers real
const mockVerifyPassword = vi.fn();
const mockHashPassword = vi.fn();
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    verifyPassword: (...args: unknown[]) => mockVerifyPassword(...args),
    hashPassword: (...args: unknown[]) => mockHashPassword(...args),
    getSession: vi.fn().mockResolvedValue(null),
  };
});

// Suppress audit logging and logger
vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
  auditRequestInfo: vi.fn().mockReturnValue({ ip: "127.0.0.1", userAgent: "test" }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Email — fire-and-forget, just mock
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendAthleteJoinedEmail: vi.fn().mockResolvedValue(undefined),
}));

// Coach data module (uses React cache() which isn't available in test env)
vi.mock("@/lib/data/coach", () => ({
  fetchCoachByUserId: vi.fn(),
  PLAN_LIMITS: { FREE: 3, PRO: 25, ELITE: Infinity },
}));

// MFA
vi.mock("@/lib/mfa", () => ({
  signMfaSessionToken: vi.fn().mockReturnValue("mfa-session-token-123"),
}));

// Reset token store
const mockStoreToken = vi.fn();
const mockGetToken = vi.fn();
const mockDeleteToken = vi.fn();
vi.mock("@/lib/resetTokenStore", () => ({
  storeToken: (...args: unknown[]) => mockStoreToken(...args),
  getToken: (...args: unknown[]) => mockGetToken(...args),
  deleteToken: (...args: unknown[]) => mockDeleteToken(...args),
}));

// Token blacklist
vi.mock("@/lib/token-blacklist", () => ({
  blacklistToken: vi.fn().mockResolvedValue(undefined),
  isBlacklisted: vi.fn().mockResolvedValue(false),
}));

// next/headers cookies (used by logout)
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "mock-jwt-token" }),
  }),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function allowRateLimit() {
  mockRateLimit.mockResolvedValue({ success: true, remaining: 4, retryAfter: 0 });
}

function blockRateLimit() {
  mockRateLimit.mockResolvedValue({ success: false, remaining: 0, retryAfter: 30_000 });
}

// ── Import routes AFTER mocks ──────────────────────────────────────────────

import { POST as loginPOST } from "../login/route";
import { POST as registerPOST } from "../register/route";
import { POST as logoutPOST } from "../logout/route";
import { POST as forgotPasswordPOST } from "../forgot-password/route";
import { POST as resetPasswordPOST } from "../reset-password/route";

// ════════════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowRateLimit();
  });

  it("returns 200 + auth cookie on valid credentials", async () => {
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      email: "coach@example.com",
      role: "COACH",
      passwordHash: "hashed-pw",
      isAdmin: false,
      coachProfile: { mfaEnabled: false },
    });
    mockVerifyPassword.mockResolvedValue(true);

    const res = await loginPOST(makeRequest({ email: "coach@example.com", password: "password123" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.user.email).toBe("coach@example.com");
    expect(json.data.user.role).toBe("COACH");
    expect(json.data.redirectTo).toBe("/coach/dashboard");

    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c: string) => c.startsWith("auth-token="))).toBe(true);
  });

  it("returns 401 for non-existent user", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await loginPOST(makeRequest({ email: "nobody@test.com", password: "password123" }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid email or password");
  });

  it("returns 401 for wrong password", async () => {
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      email: "coach@example.com",
      role: "COACH",
      passwordHash: "hashed-pw",
      isAdmin: false,
      coachProfile: null,
    });
    mockVerifyPassword.mockResolvedValue(false);

    const res = await loginPOST(makeRequest({ email: "coach@example.com", password: "wrongpass1" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 for unclaimed account (no password hash)", async () => {
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      email: "unclaimed@test.com",
      role: "ATHLETE",
      passwordHash: null,
      isAdmin: false,
      coachProfile: null,
    });

    const res = await loginPOST(makeRequest({ email: "unclaimed@test.com", password: "password123" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing fields", async () => {
    const res = await loginPOST(makeRequest({ email: "test@test.com" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 for invalid email format", async () => {
    const res = await loginPOST(makeRequest({ email: "not-an-email", password: "password123" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for short password", async () => {
    const res = await loginPOST(makeRequest({ email: "test@test.com", password: "short" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    blockRateLimit();

    const res = await loginPOST(makeRequest({ email: "test@test.com", password: "password123" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns MFA challenge for coach with MFA enabled", async () => {
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      email: "coach@example.com",
      role: "COACH",
      passwordHash: "hashed-pw",
      isAdmin: false,
      coachProfile: { mfaEnabled: true },
    });
    mockVerifyPassword.mockResolvedValue(true);

    const res = await loginPOST(makeRequest({ email: "coach@example.com", password: "password123" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.requiresMfa).toBe(true);
    expect(json.data.mfaSessionToken).toBe("mfa-session-token-123");
  });

  it("redirects athlete to /athlete/dashboard", async () => {
    mockFindUnique.mockResolvedValue({
      id: "user-2",
      email: "athlete@example.com",
      role: "ATHLETE",
      passwordHash: "hashed-pw",
      isAdmin: false,
      coachProfile: null,
    });
    mockVerifyPassword.mockResolvedValue(true);

    const res = await loginPOST(makeRequest({ email: "athlete@example.com", password: "password123" }));
    const json = await res.json();
    expect(json.data.redirectTo).toBe("/athlete/dashboard");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// REGISTER
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/register", () => {
  const validCoachBody = {
    email: "newcoach@test.com",
    password: "securepass123",
    firstName: "Jane",
    lastName: "Doe",
    role: "COACH",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    allowRateLimit();
    mockHashPassword.mockResolvedValue("hashed-password");
  });

  it("returns 201 + auth cookie for new coach", async () => {
    mockFindUnique.mockResolvedValue(null); // no existing user
    mockTransaction.mockImplementation(async (fn: (...args: unknown[]) => unknown) => {
      const newUser = { id: "new-1", email: "newcoach@test.com", role: "COACH" };
      return fn({
        user: { create: vi.fn().mockResolvedValue(newUser) },
        coachProfile: { create: vi.fn().mockResolvedValue({}) },
        athleteProfile: { create: vi.fn(), count: vi.fn() },
        invitation: { update: vi.fn() },
      });
    });

    const res = await registerPOST(makeRequest(validCoachBody));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.user.email).toBe("newcoach@test.com");
    expect(json.user.role).toBe("COACH");
    expect(json.redirectTo).toBe("/coach/onboarding/welcome");
  });

  it("returns 409 for duplicate email", async () => {
    mockFindUnique.mockResolvedValue({ id: "existing-user" });

    const res = await registerPOST(makeRequest(validCoachBody));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("An account with this email already exists");
  });

  it("returns 400 for missing required fields", async () => {
    const res = await registerPOST(makeRequest({ email: "test@test.com", password: "password123" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 for invalid role", async () => {
    const res = await registerPOST(
      makeRequest({ ...validCoachBody, role: "ADMIN" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    blockRateLimit();

    const res = await registerPOST(makeRequest(validCoachBody));
    expect(res.status).toBe(429);
  });

  it("normalizes email to lowercase", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (fn: (...args: unknown[]) => unknown) => {
      const newUser = { id: "new-1", email: "newcoach@test.com", role: "COACH" };
      return fn({
        user: { create: vi.fn().mockResolvedValue(newUser) },
        coachProfile: { create: vi.fn().mockResolvedValue({}) },
        athleteProfile: { create: vi.fn(), count: vi.fn() },
        invitation: { update: vi.fn() },
      });
    });

    const res = await registerPOST(
      makeRequest({ ...validCoachBody, email: "NewCoach@TEST.com" })
    );
    const json = await res.json();
    expect(json.user.email).toBe("newcoach@test.com");
  });

  it("includes checkout redirect when plan is provided", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (fn: (...args: unknown[]) => unknown) => {
      const newUser = { id: "new-1", email: "newcoach@test.com", role: "COACH" };
      return fn({
        user: { create: vi.fn().mockResolvedValue(newUser) },
        coachProfile: { create: vi.fn().mockResolvedValue({}) },
        athleteProfile: { create: vi.fn(), count: vi.fn() },
        invitation: { update: vi.fn() },
      });
    });

    const res = await registerPOST(
      makeRequest({ ...validCoachBody, plan: "pro", interval: "annual" })
    );
    const json = await res.json();
    expect(json.redirectTo).toBe("/coach/dashboard?checkout=pro&interval=annual");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success and clears auth cookie", async () => {
    const res = await logoutPOST(makeRequest({}));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c: string) => c.includes("auth-token=;"))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowRateLimit();
  });

  it("returns success message for existing user", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-1", email: "user@test.com" });
    mockStoreToken.mockResolvedValue(undefined);

    const res = await forgotPasswordPOST(makeRequest({ email: "user@test.com" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toContain("If an account with that email exists");
    expect(mockStoreToken).toHaveBeenCalledTimes(1);
  });

  it("returns same success message for non-existent user (no email enumeration)", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await forgotPasswordPOST(makeRequest({ email: "nobody@test.com" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toContain("If an account with that email exists");
    expect(mockStoreToken).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid email", async () => {
    const res = await forgotPasswordPOST(makeRequest({ email: "not-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    blockRateLimit();

    const res = await forgotPasswordPOST(makeRequest({ email: "user@test.com" }));
    expect(res.status).toBe(429);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// RESET PASSWORD
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowRateLimit();
    mockHashPassword.mockResolvedValue("new-hashed-password");
  });

  it("resets password with valid token", async () => {
    mockGetToken.mockResolvedValue({
      userId: "user-1",
      expiresAt: new Date(Date.now() + 3600_000),
    });
    mockUpdate.mockResolvedValue({});
    mockDeleteToken.mockResolvedValue(undefined);

    const res = await resetPasswordPOST(
      makeRequest({ token: "valid-token-abc123", password: "newpassword123" })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toContain("Password has been reset successfully");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { passwordHash: "new-hashed-password" },
      })
    );
    expect(mockDeleteToken).toHaveBeenCalledWith("valid-token-abc123");
  });

  it("returns 400 for invalid/expired token", async () => {
    mockGetToken.mockResolvedValue(null);

    const res = await resetPasswordPOST(
      makeRequest({ token: "expired-token", password: "newpassword123" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid or expired reset token");
  });

  it("returns 400 for missing token", async () => {
    const res = await resetPasswordPOST(makeRequest({ password: "newpassword123" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for short password", async () => {
    const res = await resetPasswordPOST(makeRequest({ token: "valid-token", password: "short" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    blockRateLimit();

    const res = await resetPasswordPOST(
      makeRequest({ token: "valid-token-abc123", password: "newpassword123" })
    );
    expect(res.status).toBe(429);
  });
});
