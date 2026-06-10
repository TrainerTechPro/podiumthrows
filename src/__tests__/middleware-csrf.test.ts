import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// The analysis route tests call handlers directly and never exercise the
// middleware, which is exactly how the missing-CSRF-header bug shipped.
// These tests pin the middleware contract itself.

vi.mock("@/lib/auth-edge", () => ({ verifyTokenEdge: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, retryAfter: 0 }),
}));
vi.mock("@/lib/flags", () => ({ getFlags: vi.fn().mockResolvedValue({}) }));

import { middleware } from "@/middleware";
import { rateLimit } from "@/lib/rate-limit";

const TOKEN = "a".repeat(64);

function apiPost(path: string, opts: { cookie?: string; header?: string } = {}) {
  const headers = new Headers();
  if (opts.cookie) headers.set("cookie", `csrf-token=${opts.cookie}`);
  if (opts.header) headers.set("x-csrf-token", opts.header);
  return new NextRequest(`http://localhost${path}`, { method: "POST", headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  (rateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, retryAfter: 0 });
});

describe("middleware CSRF protection for analysis mutations", () => {
  it("rejects a POST to /api/analysis/uploads without the CSRF header", async () => {
    const res = await middleware(apiPost("/api/analysis/uploads", { cookie: TOKEN }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Invalid CSRF token" });
  });

  it("rejects a POST with neither cookie nor header", async () => {
    const res = await middleware(apiPost("/api/analysis/uploads"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Invalid CSRF token" });
  });

  it("rejects a POST when header does not match cookie", async () => {
    const res = await middleware(
      apiPost("/api/analysis/uploads", { cookie: TOKEN, header: "b".repeat(64) })
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Invalid CSRF token" });
  });

  it("passes through when cookie and header match", async () => {
    const res = await middleware(
      apiPost("/api/analysis/uploads", { cookie: TOKEN, header: TOKEN })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes through other analysis mutation routes with matching token", async () => {
    for (const path of ["/api/analysis/calibration", "/api/analysis/jobs"]) {
      const res = await middleware(apiPost(path, { cookie: TOKEN, header: TOKEN }));
      expect(res.status, path).toBe(200);
      expect(res.headers.get("x-middleware-next"), path).toBe("1");
    }
  });

  it("keeps the analysis pose webhook exempt (HMAC-verified in the route)", async () => {
    const res = await middleware(apiPost("/api/analysis/webhooks/pose"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps cron routes exempt (Bearer CRON_SECRET in the route)", async () => {
    const res = await middleware(apiPost("/api/cron/check-stale"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
