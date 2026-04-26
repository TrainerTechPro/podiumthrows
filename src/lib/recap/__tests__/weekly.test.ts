import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  athleteFindUnique: vi.fn(),
  assignmentFindMany: vi.fn(),
  assignmentCount: vi.fn(),
  blockLogAggregate: vi.fn(),
  prFindMany: vi.fn(),
  readinessFindMany: vi.fn(),
  assignmentFindFirst: vi.fn(),
  competitionFindFirst: vi.fn(),
  blockLogCount: vi.fn(),
  readinessCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: {
      findUnique: (...a: unknown[]) => mocks.athleteFindUnique(...a),
    },
    throwsAssignment: {
      findMany: (...a: unknown[]) => mocks.assignmentFindMany(...a),
      count: (...a: unknown[]) => mocks.assignmentCount(...a),
      findFirst: (...a: unknown[]) => mocks.assignmentFindFirst(...a),
    },
    throwsBlockLog: {
      aggregate: (...a: unknown[]) => mocks.blockLogAggregate(...a),
      count: (...a: unknown[]) => mocks.blockLogCount(...a),
    },
    throwsPR: {
      findMany: (...a: unknown[]) => mocks.prFindMany(...a),
    },
    readinessCheckIn: {
      findMany: (...a: unknown[]) => mocks.readinessFindMany(...a),
      count: (...a: unknown[]) => mocks.readinessCount(...a),
    },
    throwsCompetition: {
      findFirst: (...a: unknown[]) => mocks.competitionFindFirst(...a),
    },
  },
}));

import { buildWeeklyRecap } from "../weekly";

const ATHLETE = { id: "ath_1", firstName: "Riley", currentStreak: 5, lastActivityDate: new Date() };

// A fixed Monday in week-of-2026-04-20 (UTC).
const MONDAY = new Date("2026-04-20T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.athleteFindUnique.mockResolvedValue(ATHLETE);
  mocks.assignmentCount.mockResolvedValue(0);
  mocks.assignmentFindMany.mockResolvedValue([]);
  mocks.assignmentFindFirst.mockResolvedValue(null);
  mocks.blockLogAggregate.mockResolvedValue({ _count: { _all: 0 } });
  mocks.prFindMany.mockResolvedValue([]);
  mocks.readinessFindMany.mockResolvedValue([]);
  mocks.competitionFindFirst.mockResolvedValue(null);
});

describe("buildWeeklyRecap", () => {
  it("first-week scenario — zero logs returns shoutout that invites a fresh start", async () => {
    const recap = await buildWeeklyRecap("ath_1", { weekStartingMonday: MONDAY });

    expect(recap.weekStart).toBe("2026-04-20");
    expect(recap.weekEnd).toBe("2026-04-26");
    expect(recap.sessionsLogged).toBe(0);
    expect(recap.throwsLogged).toBe(0);
    expect(recap.prs).toHaveLength(0);
    expect(recap.avgIntensity).toBeNull();
    expect(recap.readinessAvg).toBeNull();
    expect(recap.shoutout).toMatch(/fresh start/i);
  });

  it("PR-week scenario — top PR drives shoutout and is sorted by distance desc", async () => {
    mocks.assignmentFindMany.mockResolvedValue([
      { id: "a1", rpe: 8, completedAt: new Date("2026-04-21T10:00:00Z") },
      { id: "a2", rpe: 7, completedAt: new Date("2026-04-23T10:00:00Z") },
      { id: "a3", rpe: 9, completedAt: new Date("2026-04-25T10:00:00Z") },
    ]);
    mocks.assignmentCount.mockResolvedValue(3); // sessionsScheduled
    mocks.blockLogAggregate.mockResolvedValue({ _count: { _all: 42 } });
    mocks.prFindMany.mockResolvedValue([
      { event: "SHOT_PUT", implement: "7.26kg", distance: 18.42 },
      { event: "DISCUS", implement: "2kg", distance: 60.5 },
    ]);
    mocks.readinessFindMany.mockResolvedValue([
      { overallScore: 7 },
      { overallScore: 8 },
      { overallScore: 6 },
    ]);

    const recap = await buildWeeklyRecap("ath_1", { weekStartingMonday: MONDAY });

    expect(recap.sessionsLogged).toBe(3);
    expect(recap.sessionsScheduled).toBe(3);
    expect(recap.throwsLogged).toBe(42);
    expect(recap.avgIntensity).toBeCloseTo(8.0, 1); // (8 + 7 + 9) / 3
    expect(recap.readinessAvg).toBeCloseTo(7.0, 1);
    expect(recap.prs).toHaveLength(2);
    expect(recap.prs[0].event).toBe("SHOT_PUT");
    expect(recap.prs[0].distance).toBe(18.42);
    expect(recap.shoutout).toContain("Shot Put");
    expect(recap.shoutout).toContain("18.42m");
    // Streak math: 3 unique-day activity in window → start = end - 3
    expect(recap.streakDelta).toBe(3);
    expect(recap.streakEnd).toBe(5);
    expect(recap.streakStart).toBe(2);
  });

  it("normal-week scenario without PR uses streak-based shoutout when delta >= 4", async () => {
    mocks.athleteFindUnique.mockResolvedValue({ ...ATHLETE, currentStreak: 12 });
    mocks.assignmentFindMany.mockResolvedValue([
      { id: "a1", rpe: 7, completedAt: new Date("2026-04-20T10:00:00Z") },
      { id: "a2", rpe: 7, completedAt: new Date("2026-04-22T10:00:00Z") },
      { id: "a3", rpe: 7, completedAt: new Date("2026-04-24T10:00:00Z") },
      { id: "a4", rpe: 7, completedAt: new Date("2026-04-25T10:00:00Z") },
    ]);
    mocks.blockLogAggregate.mockResolvedValue({ _count: { _all: 25 } });

    const recap = await buildWeeklyRecap("ath_1", { weekStartingMonday: MONDAY });

    expect(recap.sessionsLogged).toBe(4);
    expect(recap.streakDelta).toBe(4);
    expect(recap.shoutout).toMatch(/4 sessions this week/);
  });

  it("nextWeekPreview prefers earliest competition over next assignment when sooner", async () => {
    mocks.assignmentFindFirst.mockResolvedValue({ assignedDate: "2026-05-05" });
    mocks.competitionFindFirst.mockResolvedValue({ date: "2026-05-02" });
    mocks.assignmentCount
      .mockResolvedValueOnce(0) // initial sessionsScheduled
      .mockResolvedValueOnce(7); // sessionsNextWeek (the second call)

    const recap = await buildWeeklyRecap("ath_1", { weekStartingMonday: MONDAY });

    expect(recap.nextWeekPreview.sessionsCount).toBe(7);
    expect(recap.nextWeekPreview.keyDate).toBe("2026-05-02");
  });

  it("throws when athlete profile is missing", async () => {
    mocks.athleteFindUnique.mockResolvedValue(null);
    await expect(buildWeeklyRecap("missing", { weekStartingMonday: MONDAY })).rejects.toThrow(
      /Athlete not found/
    );
  });
});
