import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  canAccessAthlete: vi.fn().mockResolvedValue(true),
  getCurrentUser: vi.fn().mockResolvedValue({ userId: "u1", email: "c@test.com", role: "COACH" }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteInsight: {
      findUnique: (...a: unknown[]) => mocks.findUnique(...a),
      update: (...a: unknown[]) => mocks.update(...a),
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...a: unknown[]) => mocks.getCurrentUser(...a),
}));
vi.mock("@/lib/authorize", () => ({
  canAccessAthlete: (...a: unknown[]) => mocks.canAccessAthlete(...a),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { PATCH } from "../route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("PATCH /api/insights/[id]/read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canAccessAthlete.mockResolvedValue(true);
    mocks.getCurrentUser.mockResolvedValue({ userId: "u1", email: "c@test.com", role: "COACH" });
  });

  it("coach sets readByCoachAt", async () => {
    mocks.findUnique.mockResolvedValue({
      athleteId: "a1",
      readByCoachAt: null,
      readByAthleteAt: null,
    });
    mocks.update.mockResolvedValue({});

    const req = new NextRequest("http://t/api/insights/i1/read", { method: "PATCH" });
    const res = await PATCH(req, ctx("i1"));
    expect(res.status).toBe(200);

    const call = mocks.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "i1" });
    expect(call.data.readByCoachAt).toBeInstanceOf(Date);
    expect(call.data.readByAthleteAt).toBeUndefined();
  });

  it("athlete sets readByAthleteAt", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({
      userId: "u2",
      email: "a@test.com",
      role: "ATHLETE",
    });
    mocks.findUnique.mockResolvedValue({
      athleteId: "a1",
      readByCoachAt: null,
      readByAthleteAt: null,
    });
    mocks.update.mockResolvedValue({});

    const req = new NextRequest("http://t/api/insights/i1/read", { method: "PATCH" });
    const res = await PATCH(req, ctx("i1"));
    expect(res.status).toBe(200);
    const call = mocks.update.mock.calls[0][0];
    expect(call.data.readByAthleteAt).toBeInstanceOf(Date);
    expect(call.data.readByCoachAt).toBeUndefined();
  });

  it("is idempotent — preserves existing readByCoachAt timestamp", async () => {
    const priorDate = new Date("2026-04-01T00:00:00Z");
    mocks.findUnique.mockResolvedValue({
      athleteId: "a1",
      readByCoachAt: priorDate,
      readByAthleteAt: null,
    });
    mocks.update.mockResolvedValue({});

    const req = new NextRequest("http://t/api/insights/i1/read", { method: "PATCH" });
    await PATCH(req, ctx("i1"));

    const call = mocks.update.mock.calls[0][0];
    expect(call.data.readByCoachAt).toEqual(priorDate);
  });

  it("404 when insight not found", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const req = new NextRequest("http://t/api/insights/i1/read", { method: "PATCH" });
    const res = await PATCH(req, ctx("i1"));
    expect(res.status).toBe(404);
  });

  it("403 when canAccessAthlete returns false", async () => {
    mocks.findUnique.mockResolvedValue({
      athleteId: "a1",
      readByCoachAt: null,
      readByAthleteAt: null,
    });
    mocks.canAccessAthlete.mockResolvedValueOnce(false);
    const req = new NextRequest("http://t/api/insights/i1/read", { method: "PATCH" });
    const res = await PATCH(req, ctx("i1"));
    expect(res.status).toBe(403);
  });
});
