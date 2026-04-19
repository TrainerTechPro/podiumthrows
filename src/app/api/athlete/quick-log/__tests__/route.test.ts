import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  athleteFindUnique: vi.fn(),
  athleteThrowsSessionFindFirst: vi.fn(),
  athleteThrowsSessionCreate: vi.fn(),
  throwLogFindFirst: vi.fn(),
  throwLogCreate: vi.fn(),
  throwLogUpdate: vi.fn(),
  throwLogFindUnique: vi.fn(),
  throwLogCount: vi.fn(),
  checkAndSetPR: vi.fn(),
  updateThrowsStreak: vi.fn(),
  emitPR: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: (...a: unknown[]) => mocks.getSession(...a),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: {
      findUnique: (...a: unknown[]) => mocks.athleteFindUnique(...a),
    },
    athleteThrowsSession: {
      findFirst: (...a: unknown[]) => mocks.athleteThrowsSessionFindFirst(...a),
      create: (...a: unknown[]) => mocks.athleteThrowsSessionCreate(...a),
    },
    throwLog: {
      findFirst: (...a: unknown[]) => mocks.throwLogFindFirst(...a),
      create: (...a: unknown[]) => mocks.throwLogCreate(...a),
      update: (...a: unknown[]) => mocks.throwLogUpdate(...a),
      findUnique: (...a: unknown[]) => mocks.throwLogFindUnique(...a),
      count: (...a: unknown[]) => mocks.throwLogCount(...a),
    },
  },
}));

vi.mock("@/lib/throws", () => ({
  checkAndSetPR: (...a: unknown[]) => mocks.checkAndSetPR(...a),
  COMPETITION_WEIGHTS: {
    SHOT_PUT: { male: 7.26, female: 4 },
    DISCUS: { male: 2, female: 1 },
    HAMMER: { male: 7.26, female: 4 },
    JAVELIN: { male: 0.8, female: 0.6 },
  },
  IMPLEMENT_PRESETS: {
    SHOT_PUT: { male: [5, 6, 7.26, 8], female: [3, 4, 5] },
    DISCUS: { male: [1.5, 2, 2.5], female: [1, 1.5] },
    HAMMER: { male: [6, 7.26, 8], female: [3, 4, 5] },
    JAVELIN: { male: [0.7, 0.8, 0.9], female: [0.5, 0.6, 0.7] },
  },
}));

vi.mock("@/lib/streak", () => ({
  updateThrowsStreak: (...a: unknown[]) => mocks.updateThrowsStreak(...a),
}));

vi.mock("@/lib/team-activity", () => ({
  emitPR: (...a: unknown[]) => mocks.emitPR(...a),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("next/cache", () => ({
  revalidateTag: (...a: unknown[]) => mocks.revalidateTag(...a),
}));

vi.mock("@/lib/dates", () => ({
  resolveTimezone: vi.fn(() => "America/New_York"),
  getLocalDate: vi.fn(() => new Date("2026-04-18T00:00:00Z")),
  startOfToday: vi.fn(() => new Date("2026-04-18T04:00:00Z")),
}));

import { POST, PATCH } from "../route";

// ── Helpers ──────────────────────────────────────────────────────────────

function seedAuthedAthlete() {
  mocks.getSession.mockResolvedValue({
    userId: "u1",
    email: "a@test.com",
    role: "ATHLETE",
  });
  mocks.athleteFindUnique.mockResolvedValue({
    id: "ath1",
    coachId: "coach1",
    gender: "MALE",
    events: ["SHOT_PUT"],
    timezone: "America/New_York",
  });
}

function seedHappyPathStubs() {
  mocks.athleteThrowsSessionFindFirst.mockResolvedValue(null);
  mocks.athleteThrowsSessionCreate.mockResolvedValue({ id: "sess1" });
  mocks.throwLogFindFirst.mockResolvedValue(null);
  mocks.throwLogCreate.mockResolvedValue({
    id: "throw1",
    distance: 15.5,
    notes: null,
    isPersonalBest: false,
    date: new Date("2026-04-18T12:00:00Z"),
  });
  mocks.throwLogCount.mockResolvedValue(1);
  mocks.checkAndSetPR.mockResolvedValue({ isPersonalBest: false, previousDistance: null });
  mocks.updateThrowsStreak.mockResolvedValue(undefined);
}

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://t/api/athlete/quick-log", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makePatch(body: unknown): NextRequest {
  return new NextRequest("http://t/api/athlete/quick-log", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("POST /api/athlete/quick-log — Zod validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a valid throw and returns {success, data}", async () => {
    seedAuthedAthlete();
    seedHappyPathStubs();

    const res = await POST(
      makePost({ event: "SHOT_PUT", implementWeight: 7.26, distance: 15.5 })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.throw.id).toBe("throw1");
    expect(mocks.throwLogCreate).toHaveBeenCalledOnce();
  });

  it("rejects invalid event with 400 + fieldErrors", async () => {
    seedAuthedAthlete();

    const res = await POST(
      makePost({ event: "INVALID", implementWeight: 7.26 })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.fieldErrors).toBeDefined();
    expect(body.fieldErrors.some((e: { field: string }) => e.field === "event")).toBe(true);
    expect(mocks.throwLogCreate).not.toHaveBeenCalled();
  });

  it("rejects zero implementWeight (must be positive)", async () => {
    seedAuthedAthlete();

    const res = await POST(makePost({ event: "SHOT_PUT", implementWeight: 0 }));
    expect(res.status).toBe(400);
    expect(mocks.throwLogCreate).not.toHaveBeenCalled();
  });

  it("accepts distance=0 per CLAUDE.md §3 (zero is a valid value)", async () => {
    seedAuthedAthlete();
    seedHappyPathStubs();
    mocks.throwLogCreate.mockResolvedValue({
      id: "throw1",
      distance: 0,
      notes: null,
      isPersonalBest: false,
      date: new Date(),
    });

    const res = await POST(
      makePost({ event: "SHOT_PUT", implementWeight: 7.26, distance: 0 })
    );
    expect(res.status).toBe(200);
    expect(mocks.throwLogCreate).toHaveBeenCalledOnce();
    // distance=0 must skip PR detection
    expect(mocks.checkAndSetPR).not.toHaveBeenCalled();
  });

  it("accepts feeling: null (React form state) per CLAUDE.md §4", async () => {
    seedAuthedAthlete();
    seedHappyPathStubs();

    const res = await POST(
      makePost({
        event: "SHOT_PUT",
        implementWeight: 7.26,
        distance: 15.5,
        feeling: null,
        notes: null,
      })
    );
    expect(res.status).toBe(200);
  });

  it("rejects feeling outside enum", async () => {
    seedAuthedAthlete();

    const res = await POST(
      makePost({
        event: "SHOT_PUT",
        implementWeight: 7.26,
        feeling: "euphoric",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON with 400 Invalid JSON body", async () => {
    seedAuthedAthlete();

    const req = new NextRequest("http://t/api/athlete/quick-log", {
      method: "POST",
      body: "not-valid-json",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
  });

  it("401 when no session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const res = await POST(
      makePost({ event: "SHOT_PUT", implementWeight: 7.26 })
    );
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/athlete/quick-log — Zod validation + ownership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects PATCH without id", async () => {
    seedAuthedAthlete();

    const res = await PATCH(makePatch({ distance: 16.2 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fieldErrors.some((e: { field: string }) => e.field === "id")).toBe(true);
  });

  it("rejects PATCH with empty id", async () => {
    seedAuthedAthlete();

    const res = await PATCH(makePatch({ id: "", distance: 16.2 }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when editing another athlete's throw", async () => {
    seedAuthedAthlete();
    mocks.throwLogFindUnique.mockResolvedValue({
      id: "t99",
      athleteId: "other-athlete",
      event: "SHOT_PUT",
      implementWeight: 7.26,
      distance: 14,
      notes: null,
      isPersonalBest: false,
    });

    const res = await PATCH(makePatch({ id: "t99", distance: 20 }));
    expect(res.status).toBe(403);
    expect(mocks.throwLogUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when the throw doesn't exist", async () => {
    seedAuthedAthlete();
    mocks.throwLogFindUnique.mockResolvedValue(null);

    const res = await PATCH(makePatch({ id: "missing", distance: 20 }));
    expect(res.status).toBe(404);
  });

  it("accepts a valid edit", async () => {
    seedAuthedAthlete();
    mocks.throwLogFindUnique.mockResolvedValue({
      id: "t1",
      athleteId: "ath1",
      event: "SHOT_PUT",
      implementWeight: 7.26,
      distance: 14,
      notes: null,
      isPersonalBest: false,
    });
    mocks.throwLogUpdate.mockResolvedValue({
      id: "t1",
      distance: 16.5,
      notes: null,
      isPersonalBest: false,
      date: new Date("2026-04-18T12:00:00Z"),
    });
    mocks.checkAndSetPR.mockResolvedValue({
      isPersonalBest: true,
      previousDistance: 14,
    });

    const res = await PATCH(makePatch({ id: "t1", distance: 16.5 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.throw.id).toBe("t1");
  });
});
