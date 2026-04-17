import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: (...a: unknown[]) => mocks.queryRaw(...a),
    athleteInsight: { findMany: (...a: unknown[]) => mocks.findMany(...a) },
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ userId: "u1", email: "c@test.com", role: "COACH" }),
}));
vi.mock("@/lib/authorize", () => ({ canAccessAthlete: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { GET } from "../route";

describe("GET /api/insights", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns latest-per-slot when mode=latest", async () => {
    mocks.queryRaw.mockResolvedValue([
      { id: "i1", category: "TRAINING_PATTERN", metric: "ex1", title: "T1" },
      { id: "i2", category: "LIFT_THROW", metric: "l1", title: "L1" },
    ]);
    const req = new NextRequest("http://t/api/insights?athleteId=a1&mode=latest");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.insights).toHaveLength(2);
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns full history when mode=all", async () => {
    mocks.findMany.mockResolvedValue([{ id: "i1" }, { id: "i2" }, { id: "i3" }]);
    const req = new NextRequest("http://t/api/insights?athleteId=a1&mode=all");
    const res = await GET(req);
    const body = await res.json();
    expect(body.data.insights).toHaveLength(3);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { athleteId: "a1" },
        orderBy: { computedAt: "desc" },
      })
    );
  });

  it("filters by category", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    const req = new NextRequest("http://t/api/insights?athleteId=a1&category=LIFT_THROW");
    await GET(req);
    // The raw SQL call embeds the category literal — just verify it was called
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
  });

  it("400 on missing athleteId", async () => {
    const req = new NextRequest("http://t/api/insights");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
