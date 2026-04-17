import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  runInsights: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/insights/runInsights", () => ({
  runInsights: (...a: unknown[]) => mocks.runInsights(...a),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => mocks.rateLimit(...a),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ userId: "u1", email: "c@test.com", role: "COACH" }),
}));
vi.mock("@/lib/authorize", () => ({ canAccessAthlete: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { POST } from "../route";

describe("POST /api/insights/compute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs insights and returns persistedCount", async () => {
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.runInsights.mockResolvedValue({ persistedCount: 3, skippedAnalyzers: [] });
    const req = new NextRequest("http://t/api/insights/compute", {
      method: "POST",
      body: JSON.stringify({ athleteId: "a1" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.persistedCount).toBe(3);
    expect(mocks.runInsights).toHaveBeenCalledWith(
      expect.objectContaining({ athleteId: "a1", trigger: "ON_DEMAND" })
    );
  });

  it("returns 429 on rate limit", async () => {
    mocks.rateLimit.mockResolvedValue({ success: false, retryAfter: 45 });
    const req = new NextRequest("http://t/api/insights/compute", {
      method: "POST",
      body: JSON.stringify({ athleteId: "a1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(mocks.runInsights).not.toHaveBeenCalled();
  });

  it("400 on bad body", async () => {
    const req = new NextRequest("http://t/api/insights/compute", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
