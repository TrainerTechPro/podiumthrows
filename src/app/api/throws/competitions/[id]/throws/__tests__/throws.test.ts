import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCompFindUnique = vi.fn();
const mockThrowFindMany = vi.fn();
const mockThrowCreate = vi.fn();
const mockCompUpdate = vi.fn();
const mockGetAthletePRs = vi.fn();
const mockNotify = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    throwsCompetition: {
      findUnique: (...a: unknown[]) => mockCompFindUnique(...a),
      update: (...a: unknown[]) => mockCompUpdate(...a),
    },
    throwLog: {
      findMany: (...a: unknown[]) => mockThrowFindMany(...a),
      create: (...a: unknown[]) => mockThrowCreate(...a),
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ userId: "u1", email: "c@test.com", role: "COACH" }),
}));
vi.mock("@/lib/authorize", () => ({ canAccessAthlete: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/data/personal-records", () => ({
  getAthletePRs: (...a: unknown[]) => mockGetAthletePRs(...a),
}));
vi.mock("@/lib/competitions/notify", () => ({
  notifyCompetitionEvent: (...a: unknown[]) => mockNotify(...a),
}));

import { GET, POST } from "../route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const competitionWeight = 7.26;

describe("GET /api/throws/competitions/[id]/throws", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns throws ordered by (round, attemptInRound)", async () => {
    mockCompFindUnique.mockResolvedValue({ id: "m1", athleteId: "a1" });
    mockThrowFindMany.mockResolvedValue([
      { id: "t1", round: "PRELIM", attemptInRound: 1 },
      { id: "t2", round: "FINALS", attemptInRound: 1 },
    ]);
    const req = new NextRequest("http://t/api/throws/competitions/m1/throws");
    const res = await GET(req, ctx("m1"));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(mockThrowFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { competitionId: "m1" },
        orderBy: [{ round: "asc" }, { attemptInRound: "asc" }],
      })
    );
  });
});

describe("POST /api/throws/competitions/[id]/throws", () => {
  beforeEach(() => vi.clearAllMocks());

  const meet = {
    id: "m1",
    athleteId: "a1",
    event: "SHOT_PUT",
    implementWeightKg: null,
    format: "THREE_PLUS_THREE",
    name: "Big Invite",
    result: 17.0,
    throws: [],
    athlete: { gender: "MALE" },
  };

  it("creates a MARK throw and clears legacy result on first", async () => {
    mockCompFindUnique.mockResolvedValue(meet);
    mockThrowCreate.mockResolvedValue({ id: "t1", distance: 18.42 });
    mockGetAthletePRs
      .mockResolvedValueOnce({ events: [{ event: "SHOT_PUT", competitionPR: null }] })
      .mockResolvedValueOnce({ events: [{ event: "SHOT_PUT", competitionPR: { distance: 18.42 } }] });

    const req = new NextRequest("http://t", {
      method: "POST",
      body: JSON.stringify({
        round: "PRELIM",
        attemptInRound: 1,
        resultType: "MARK",
        distance: 18.42,
      }),
    });
    const res = await POST(req, ctx("m1"));
    expect(res.status).toBe(200);
    expect(mockThrowCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          athleteId: "a1",
          event: "SHOT_PUT",
          implementWeight: competitionWeight,
          isCompetition: true,
          competitionId: "m1",
          round: "PRELIM",
          attemptInRound: 1,
          isFoul: false,
          isPass: false,
          distance: 18.42,
        }),
      })
    );
    expect(mockCompUpdate).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { result: null },
    });
    const body = await res.json();
    expect(body.data.prCelebration).toEqual({
      event: "SHOT_PUT",
      oldPR: 0,
      newPR: 18.42,
    });
  });

  it("returns 409 on duplicate slot", async () => {
    mockCompFindUnique.mockResolvedValue({
      ...meet,
      throws: [{ round: "PRELIM", attemptInRound: 1 }],
    });
    const req = new NextRequest("http://t", {
      method: "POST",
      body: JSON.stringify({
        round: "PRELIM",
        attemptInRound: 1,
        resultType: "PASS",
      }),
    });
    const res = await POST(req, ctx("m1"));
    expect(res.status).toBe(409);
  });

  it("rejects THREE_PLUS_THREE attempt 4", async () => {
    mockCompFindUnique.mockResolvedValue(meet);
    const req = new NextRequest("http://t", {
      method: "POST",
      body: JSON.stringify({ round: "PRELIM", attemptInRound: 4, resultType: "PASS" }),
    });
    const res = await POST(req, ctx("m1"));
    expect(res.status).toBe(400);
  });
});
