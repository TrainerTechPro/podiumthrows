import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateEnv } from "@/lib/env";

const CRITICAL = ["POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING", "JWT_SECRET"];
const TOUCHED = [
  ...CRITICAL,
  "NODE_ENV",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_ELITE",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "CRON_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "SENTRY_DSN",
  "MFA_ENCRYPTION_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "RESEND_API_KEY",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
];

const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of TOUCHED) saved[k] = process.env[k];
});
afterEach(() => {
  for (const k of TOUCHED) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Set the three critical vars so only the degradable layer is under test. */
function setCriticalPresent() {
  process.env.POSTGRES_PRISMA_URL = "postgresql://x";
  process.env.POSTGRES_URL_NON_POOLING = "postgresql://x";
  process.env.JWT_SECRET = "secret";
}

describe("validateEnv — critical vars (production only)", () => {
  it("throws naming each missing critical var in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const k of CRITICAL) delete process.env[k];
    expect(() => validateEnv()).toThrow(/POSTGRES_PRISMA_URL[\s\S]*JWT_SECRET/);
  });

  it("treats a blank string as missing in production", () => {
    setCriticalPresent();
    vi.stubEnv("NODE_ENV", "production");
    process.env.JWT_SECRET = "   ";
    expect(() => validateEnv()).toThrow(/JWT_SECRET/);
  });

  it("does not throw when all critical vars are present in production", () => {
    setCriticalPresent();
    vi.stubEnv("NODE_ENV", "production");
    // Provide the degradable set too so this test isolates the critical check.
    for (const k of TOUCHED) if (!process.env[k]) process.env[k] = "x";
    expect(() => validateEnv()).not.toThrow();
  });

  it("is a no-op in development even with everything missing (dev-lenient)", () => {
    for (const k of CRITICAL) delete process.env[k];
    vi.stubEnv("NODE_ENV", "development");
    expect(() => validateEnv()).not.toThrow();
  });
});

describe("validateEnv — degradable warnings", () => {
  it("warns (does not throw) on missing integrations in production", () => {
    setCriticalPresent();
    vi.stubEnv("NODE_ENV", "production");
    for (const k of TOUCHED) {
      if (!CRITICAL.includes(k) && k !== "NODE_ENV") delete process.env[k];
    }
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => validateEnv()).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
    const msg = warn.mock.calls[0][0] as string;
    expect(msg).toMatch(/Stripe billing/);
    expect(msg).toMatch(/Transactional email/);
  });

  it("does not warn in non-production even with everything missing", () => {
    setCriticalPresent();
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateEnv();
    expect(warn).not.toHaveBeenCalled();
  });

  it("accepts SMTP as a substitute for Resend (no email warning)", () => {
    setCriticalPresent();
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.RESEND_API_KEY;
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateEnv();
    const msg = (warn.mock.calls[0]?.[0] as string) ?? "";
    expect(msg).not.toMatch(/Transactional email/);
  });
});
