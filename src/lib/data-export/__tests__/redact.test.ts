import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { redactSensitive } from "../redact";
import { logger } from "@/lib/logger";

describe("redactSensitive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redacts top-level passwordHash", () => {
    const out = redactSensitive({ id: "u1", email: "a@b.com", passwordHash: "$2b$..." });
    expect(out).toEqual({ id: "u1", email: "a@b.com", passwordHash: "[REDACTED]" });
  });

  it("redacts nested OAuth tokens inside arrays", () => {
    const input = {
      connections: [
        { provider: "whoop", accessToken: "wt-1", refreshToken: "rt-1" },
        { provider: "oura", accessToken: "wt-2", refreshToken: "rt-2" },
      ],
    };
    const out = redactSensitive(input) as typeof input;
    for (const c of out.connections) {
      expect(c.accessToken).toBe("[REDACTED]");
      expect(c.refreshToken).toBe("[REDACTED]");
    }
  });

  it("catches new fields via the defensive regex", () => {
    const out = redactSensitive({ webhookSecret: "abc", apiToken: "def", clientHash: "xyz" });
    expect(out).toEqual({
      webhookSecret: "[REDACTED]",
      apiToken: "[REDACTED]",
      clientHash: "[REDACTED]",
    });
  });

  it("does not redact unrelated fields with similar names", () => {
    const out = redactSensitive({ tokenizedAddress: "ok", secretSauce: "ok", hashtag: "#shotput" });
    expect(out).toEqual({
      tokenizedAddress: "ok",
      secretSauce: "ok",
      hashtag: "#shotput",
    });
  });

  it("logs which fields were redacted", () => {
    redactSensitive({ passwordHash: "x", inner: { accessToken: "y" } });
    expect(logger.info).toHaveBeenCalledWith(
      "data-export: redacted fields",
      expect.objectContaining({
        metadata: { fields: expect.arrayContaining(["passwordHash", "accessToken"]) },
      })
    );
  });

  it("does not log when nothing was redacted", () => {
    redactSensitive({ id: "u1", email: "a@b.com" });
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("converts Date instances to ISO strings", () => {
    const d = new Date("2026-05-01T00:00:00Z");
    const out = redactSensitive({ createdAt: d });
    expect(out).toEqual({ createdAt: "2026-05-01T00:00:00.000Z" });
  });

  it("preserves null and undefined", () => {
    const out = redactSensitive({ a: null, b: undefined, c: 0, d: false });
    expect(out).toEqual({ a: null, b: undefined, c: 0, d: false });
  });

  it("does not mutate the input", () => {
    const input = { passwordHash: "secret", nested: { accessToken: "tok" } };
    redactSensitive(input);
    expect(input.passwordHash).toBe("secret");
    expect(input.nested.accessToken).toBe("tok");
  });
});
