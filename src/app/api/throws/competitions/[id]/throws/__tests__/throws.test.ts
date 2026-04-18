import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCompFindUnique = vi.fn();
const mockThrowFindMany = vi.fn();
const mockThrowCreate = vi.fn();
const mockThrowFindUnique = vi.fn();
const mockThrowUpdate = vi.fn();
const mockThrowDelete = vi.fn();
const mockCompUpdate = vi.fn();
const mockGetAthletePRs = vi.fn();
const mockNotify = vi.fn();
const mockWaitUntil = vi.fn();
const mockRunInsights = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    throwsCompetition: {
      findUnique: (...a: unknown[]) => mockCompFindUnique(...a),
      update: (...a: unknown[]) => mockCompUpdate(...a),
    },
    throwLog: {
      findMany: (...a: unknown[]) => mockThrowFindMany(...a),
      findUnique: (...a: unknown[]) => mockThrowFindUnique(...a),
      create: (...a: unknown[]) => mockThrowCreate(...a),
      update: (...a: unknown[]) => mockThrowUpdate(...a),
      delete: (...a: unknown[]) => mockThrowDelete(...a),
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
vi.mock("@vercel/functions", () => ({
  waitUntil: (promise: Promise<unknown>) => {
    mockWaitUntil(promise);
    // Execute synchronously in tests so assertions work
    return Promise.resolve(promise).catch(() => undefined);
  },
}));
vi.mock("@/lib/insights/runInsights", () => ({
  runInsights: (...a: unknown[]) => mockRunInsights(...a),
}));

import { GET, POST, PATCH, DELETE } from "../route";

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
    // Ordering is applied in JS (to avoid Postgres alphabetical enum sort);
    // assert the fetched scope + the resulting order.
    expect(mockThrowFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { competitionId: "m1" } })
    );
    expect(body.data.map((t: { id: string }) => t.id)).toEqual(["t1", "t2"]);
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
      .mockResolvedValueOnce({
        events: [{ event: "SHOT_PUT", competitionPR: { distance: 18.42 } }],
      });

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

describe("PATCH /api/throws/competitions/[id]/throws", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates a throw and returns prCelebration if PR improves", async () => {
    mockCompFindUnique.mockResolvedValue({
      athleteId: "a1",
      event: "SHOT_PUT",
      format: "THREE_PLUS_THREE",
      madeFinals: false,
      name: "Big Invite",
      athlete: { gender: "MALE" },
      throws: [{ id: "t1", round: "PRELIM", attemptInRound: 1 }],
    });
    mockThrowUpdate.mockResolvedValue({ id: "t1", distance: 19.0 });
    mockGetAthletePRs
      .mockResolvedValueOnce({ events: [{ event: "SHOT_PUT", competitionPR: { distance: 18.0 } }] })
      .mockResolvedValueOnce({
        events: [{ event: "SHOT_PUT", competitionPR: { distance: 19.0 } }],
      });

    const req = new NextRequest("http://t?throwLogId=t1", {
      method: "PATCH",
      body: JSON.stringify({ resultType: "MARK", distance: 19.0 }),
    });
    const res = await PATCH(req, ctx("m1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.prCelebration).toEqual({
      event: "SHOT_PUT",
      oldPR: 18.0,
      newPR: 19.0,
    });
  });

  it("accepts a notes-only PATCH", async () => {
    mockCompFindUnique.mockResolvedValue({
      athleteId: "a1",
      event: "SHOT_PUT",
      format: "THREE_PLUS_THREE",
      madeFinals: false,
      name: "Big Invite",
      athlete: { gender: "MALE" },
      throws: [{ id: "t1", round: "PRELIM", attemptInRound: 1 }],
    });
    mockThrowUpdate.mockResolvedValue({ id: "t1", notes: "great setup" });
    mockGetAthletePRs.mockResolvedValue({ events: [{ event: "SHOT_PUT", competitionPR: null }] });

    const req = new NextRequest("http://t?throwLogId=t1", {
      method: "PATCH",
      body: JSON.stringify({ notes: "great setup" }),
    });
    const res = await PATCH(req, ctx("m1"));
    expect(res.status).toBe(200);
    expect(mockThrowUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1" },
        data: expect.objectContaining({ notes: "great setup" }),
      })
    );
  });

  it("returns 404 if throwLogId doesn't belong to this meet", async () => {
    mockCompFindUnique.mockResolvedValue({
      athleteId: "a1",
      event: "SHOT_PUT",
      format: "THREE_PLUS_THREE",
      madeFinals: false,
      name: "X",
      athlete: { gender: "MALE" },
      // Throw t1 is NOT in this meet's throws array → PATCH should 404.
      throws: [{ id: "other-throw", round: "PRELIM", attemptInRound: 2 }],
    });
    const req = new NextRequest("http://t?throwLogId=t1", {
      method: "PATCH",
      body: JSON.stringify({ notes: "hi" }),
    });
    const res = await PATCH(req, ctx("m1"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/throws/competitions/[id]/throws", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes by throwLogId", async () => {
    mockCompFindUnique.mockResolvedValue({ athleteId: "a1" });
    mockThrowFindUnique.mockResolvedValue({ competitionId: "m1" });
    mockThrowDelete.mockResolvedValue({ id: "t1" });
    const req = new NextRequest("http://t?throwLogId=t1", { method: "DELETE" });
    const res = await DELETE(req, ctx("m1"));
    expect(res.status).toBe(200);
    expect(mockThrowDelete).toHaveBeenCalledWith({ where: { id: "t1" } });
  });

  it("returns 404 if throw doesn't belong to this meet", async () => {
    mockCompFindUnique.mockResolvedValue({ athleteId: "a1" });
    mockThrowFindUnique.mockResolvedValue({ competitionId: "OTHER_MEET" });
    const req = new NextRequest("http://t?throwLogId=t1", { method: "DELETE" });
    const res = await DELETE(req, ctx("m1"));
    expect(res.status).toBe(404);
  });
});

describe("POST fires runInsights on meet-complete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fires runInsights when the final prelim completes a THREE_PLUS_THREE madeFinals=false meet", async () => {
    mockCompFindUnique.mockResolvedValue({
      id: "m1",
      athleteId: "a1",
      event: "SHOT_PUT",
      implementWeightKg: null,
      format: "THREE_PLUS_THREE",
      madeFinals: false,
      name: "Dual",
      result: null,
      throws: [
        { round: "PRELIM", attemptInRound: 1 },
        { round: "PRELIM", attemptInRound: 2 },
      ],
      athlete: { gender: "MALE" },
    });
    mockThrowCreate.mockResolvedValue({ id: "t3", distance: 18.0 });
    mockGetAthletePRs
      .mockResolvedValueOnce({ events: [{ event: "SHOT_PUT", competitionPR: { distance: 18.0 } }] })
      .mockResolvedValueOnce({
        events: [{ event: "SHOT_PUT", competitionPR: { distance: 18.0 } }],
      });
    mockRunInsights.mockResolvedValue({ persistedCount: 0, skippedAnalyzers: [] });

    const req = new NextRequest("http://t", {
      method: "POST",
      body: JSON.stringify({
        round: "PRELIM",
        attemptInRound: 3,
        resultType: "MARK",
        distance: 18.0,
      }),
    });
    const res = await POST(req, ctx("m1"));
    expect(res.status).toBe(200);
    expect(mockWaitUntil).toHaveBeenCalledTimes(1);
    expect(mockRunInsights).toHaveBeenCalledWith(
      expect.objectContaining({
        athleteId: "a1",
        trigger: "MEET_COMPLETE",
        triggerMeetId: "m1",
      })
    );
  });

  it("does NOT fire runInsights when the meet is not yet complete", async () => {
    mockCompFindUnique.mockResolvedValue({
      id: "m1",
      athleteId: "a1",
      event: "SHOT_PUT",
      implementWeightKg: null,
      format: "THREE_PLUS_THREE",
      madeFinals: false,
      name: "Dual",
      result: null,
      throws: [{ round: "PRELIM", attemptInRound: 1 }],
      athlete: { gender: "MALE" },
    });
    mockThrowCreate.mockResolvedValue({ id: "t2", distance: 17.5 });
    mockGetAthletePRs
      .mockResolvedValueOnce({ events: [{ event: "SHOT_PUT", competitionPR: { distance: 18.0 } }] })
      .mockResolvedValueOnce({
        events: [{ event: "SHOT_PUT", competitionPR: { distance: 18.0 } }],
      });

    const req = new NextRequest("http://t", {
      method: "POST",
      body: JSON.stringify({
        round: "PRELIM",
        attemptInRound: 2,
        resultType: "MARK",
        distance: 17.5,
      }),
    });
    await POST(req, ctx("m1"));
    expect(mockWaitUntil).not.toHaveBeenCalled();
    expect(mockRunInsights).not.toHaveBeenCalled();
  });

  it("a failure inside runInsights does not fail the throw save", async () => {
    mockCompFindUnique.mockResolvedValue({
      id: "m1",
      athleteId: "a1",
      event: "SHOT_PUT",
      implementWeightKg: null,
      format: "FOUR_STRAIGHT",
      madeFinals: null,
      name: "Dual",
      result: null,
      throws: [
        { round: "PRELIM", attemptInRound: 1 },
        { round: "PRELIM", attemptInRound: 2 },
        { round: "PRELIM", attemptInRound: 3 },
      ],
      athlete: { gender: "MALE" },
    });
    mockThrowCreate.mockResolvedValue({ id: "t4", distance: 18.2 });
    mockGetAthletePRs
      .mockResolvedValueOnce({ events: [{ event: "SHOT_PUT", competitionPR: null }] })
      .mockResolvedValueOnce({
        events: [{ event: "SHOT_PUT", competitionPR: { distance: 18.2 } }],
      });
    mockRunInsights.mockRejectedValue(new Error("boom"));

    const req = new NextRequest("http://t", {
      method: "POST",
      body: JSON.stringify({
        round: "PRELIM",
        attemptInRound: 4,
        resultType: "MARK",
        distance: 18.2,
      }),
    });
    const res = await POST(req, ctx("m1"));
    expect(res.status).toBe(200);
  });
});
