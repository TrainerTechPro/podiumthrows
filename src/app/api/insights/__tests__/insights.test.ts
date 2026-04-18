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

// Minimal row factory — the route now runs each row through toWire(),
// which dereferences Date fields, so tests must supply realistic shapes.
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "i1",
    athleteId: "a1",
    category: "TRAINING_PATTERN",
    metric: "m1",
    event: null,
    title: "T",
    body: "B",
    detail: null,
    confidenceBand: "MEDIUM",
    dataPoints: 10,
    coefficient: 0.5,
    effectSize: null,
    effectUnit: null,
    evidence: {},
    readByCoachAt: null,
    readByAthleteAt: null,
    dismissedAt: null,
    triggerKind: "ON_DEMAND",
    triggerMeetId: null,
    computedAt: new Date("2026-04-17T00:00:00Z"),
    ...overrides,
  };
}

describe("GET /api/insights", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns latest-per-slot when mode=latest", async () => {
    mocks.queryRaw.mockResolvedValue([
      row({ id: "i1", category: "TRAINING_PATTERN", metric: "ex1", title: "T1" }),
      row({ id: "i2", category: "LIFT_THROW", metric: "l1", title: "L1" }),
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
    mocks.findMany.mockResolvedValue([row({ id: "i1" }), row({ id: "i2" }), row({ id: "i3" })]);
    const req = new NextRequest("http://t/api/insights?athleteId=a1&mode=all");
    const res = await GET(req);
    const body = await res.json();
    expect(body.data.insights).toHaveLength(3);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ athleteId: "a1" }),
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

describe("GET /api/insights (includeDismissed)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filters out dismissed rows by default in mode=all", async () => {
    mocks.findMany.mockResolvedValue([row({ id: "i1" })]);
    const req = new NextRequest("http://t/api/insights?athleteId=a1&mode=all");
    await GET(req);

    const args = mocks.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ athleteId: "a1", dismissedAt: null });
  });

  it("returns all rows when includeDismissed=true in mode=all", async () => {
    mocks.findMany.mockResolvedValue([row({ id: "i1" }), row({ id: "i2" })]);
    const req = new NextRequest(
      "http://t/api/insights?athleteId=a1&mode=all&includeDismissed=true"
    );
    await GET(req);

    const args = mocks.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ athleteId: "a1" });
    expect(args.where.dismissedAt).toBeUndefined();
  });

  it("includes dismissed filter in raw SQL for mode=latest by default", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    const req = new NextRequest("http://t/api/insights?athleteId=a1&mode=latest");
    await GET(req);

    const sqlArg = mocks.queryRaw.mock.calls[0][0];
    const combined = Array.isArray(sqlArg.strings) ? sqlArg.strings.join("") : String(sqlArg);
    expect(combined).toContain(`dismissedAt`);
  });

  it("omits dismiss filter from raw SQL when includeDismissed=true", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    const req = new NextRequest(
      "http://t/api/insights?athleteId=a1&mode=latest&includeDismissed=true"
    );
    await GET(req);

    const sqlArg = mocks.queryRaw.mock.calls[0][0];
    const combined = Array.isArray(sqlArg.strings) ? sqlArg.strings.join("") : String(sqlArg);
    expect(combined).not.toContain(`dismissedAt`);
  });
});
