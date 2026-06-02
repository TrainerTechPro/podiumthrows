import { describe, it, expect, afterEach, vi } from "vitest";
import { ensureUrlParam, resolvePooledUrl, resolveSlowQueryMs } from "@/lib/prisma";

afterEach(() => vi.unstubAllEnvs());

describe("resolveSlowQueryMs", () => {
  it("defaults to 1000 in production when unset", () => {
    expect(resolveSlowQueryMs(undefined, true)).toBe(1000);
  });

  it("defaults to 0 (off) outside production when unset", () => {
    expect(resolveSlowQueryMs(undefined, false)).toBe(0);
  });

  it("honors an explicit numeric override in any environment", () => {
    expect(resolveSlowQueryMs("500", false)).toBe(500);
    expect(resolveSlowQueryMs("500", true)).toBe(500);
  });

  it("treats 0 / negative / non-numeric as disabled", () => {
    expect(resolveSlowQueryMs("0", true)).toBe(0);
    expect(resolveSlowQueryMs("-5", true)).toBe(0);
    expect(resolveSlowQueryMs("abc", true)).toBe(0);
  });
});

describe("ensureUrlParam", () => {
  it("appends with ? when the URL has no query string", () => {
    expect(ensureUrlParam("postgresql://h/db", "connection_limit", "5")).toBe(
      "postgresql://h/db?connection_limit=5"
    );
  });

  it("appends with & when a query string already exists", () => {
    expect(ensureUrlParam("postgresql://h/db?pgbouncer=true", "connection_limit", "5")).toBe(
      "postgresql://h/db?pgbouncer=true&connection_limit=5"
    );
  });

  it("does not duplicate a param that is already present", () => {
    const url = "postgresql://h/db?connection_limit=1";
    expect(ensureUrlParam(url, "connection_limit", "5")).toBe(url);
  });

  it("matches the param as a whole key, not a substring", () => {
    // "limit" must not be considered present just because "connection_limit" is.
    const url = "postgresql://h/db?connection_limit=1";
    expect(ensureUrlParam(url, "limit", "10")).toBe(
      "postgresql://h/db?connection_limit=1&limit=10"
    );
  });

  it("preserves credentials and existing params verbatim", () => {
    const url = "postgresql://user:p%40ss@host:5432/db?pgbouncer=true&sslmode=require";
    const out = ensureUrlParam(url, "pool_timeout", "15");
    expect(out).toBe(`${url}&pool_timeout=15`);
  });
});

describe("resolvePooledUrl", () => {
  it("returns undefined when no pooled URL is configured", () => {
    vi.stubEnv("POSTGRES_PRISMA_URL", "");
    expect(resolvePooledUrl()).toBeUndefined();
  });

  it("adds explicit connection_limit + pool_timeout with defaults", () => {
    vi.stubEnv("POSTGRES_PRISMA_URL", "postgresql://h/db?pgbouncer=true");
    vi.stubEnv("DB_CONNECTION_LIMIT", "");
    vi.stubEnv("DB_POOL_TIMEOUT", "");
    expect(resolvePooledUrl()).toBe(
      "postgresql://h/db?pgbouncer=true&connection_limit=5&pool_timeout=15"
    );
  });

  it("honors env overrides", () => {
    vi.stubEnv("POSTGRES_PRISMA_URL", "postgresql://h/db");
    vi.stubEnv("DB_CONNECTION_LIMIT", "1");
    vi.stubEnv("DB_POOL_TIMEOUT", "30");
    expect(resolvePooledUrl()).toBe("postgresql://h/db?connection_limit=1&pool_timeout=30");
  });

  it("defers to a connection_limit already set on the URL", () => {
    vi.stubEnv("POSTGRES_PRISMA_URL", "postgresql://h/db?connection_limit=3");
    vi.stubEnv("DB_CONNECTION_LIMIT", "");
    vi.stubEnv("DB_POOL_TIMEOUT", "");
    expect(resolvePooledUrl()).toBe("postgresql://h/db?connection_limit=3&pool_timeout=15");
  });
});
