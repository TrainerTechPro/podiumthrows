import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAthleteFindUnique = vi.fn();
const mockLiftingLogFindMany = vi.fn();
const mockThrowLogFindMany = vi.fn();
const mockAthleteDrillLogFindMany = vi.fn();
const mockPracticeAttemptFindMany = vi.fn();
const mockThrowsBlockLogFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: { findUnique: (...a: unknown[]) => mockAthleteFindUnique(...a) },
    liftingExerciseLog: { findMany: (...a: unknown[]) => mockLiftingLogFindMany(...a) },
    throwLog: { findMany: (...a: unknown[]) => mockThrowLogFindMany(...a) },
    athleteDrillLog: { findMany: (...a: unknown[]) => mockAthleteDrillLogFindMany(...a) },
    practiceAttempt: { findMany: (...a: unknown[]) => mockPracticeAttemptFindMany(...a) },
    throwsBlockLog: { findMany: (...a: unknown[]) => mockThrowsBlockLogFindMany(...a) },
  },
}));

import { liftThrowAnalyzer } from "../liftThrowCorrelation";

// 8 windows of paired data, starting on a Monday
const WINDOW_START_DATES = Array.from({ length: 8 }, (_, i) => {
  const d = new Date("2025-11-03T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + i * 28);
  return d;
});

describe("liftThrowAnalyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: new throw sources are empty. Individual tests override
    // mockThrowLogFindMany; the other three sources contribute zero
    // rows unless a test sets them. This keeps existing test cases
    // exercising the legacy ThrowLog path untouched.
    mockAthleteDrillLogFindMany.mockResolvedValue([]);
    mockPracticeAttemptFindMany.mockResolvedValue([]);
    mockThrowsBlockLogFindMany.mockResolvedValue([]);
  });

  it("returns [] with no lifts logged", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["HAMMER"] });
    mockLiftingLogFindMany.mockResolvedValue([]);
    mockThrowLogFindMany.mockResolvedValue([]);
    const result = await liftThrowAnalyzer.analyze("a1");
    expect(result).toEqual([]);
  });

  it("skips pair with <6 paired windows", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["HAMMER"] });
    mockLiftingLogFindMany.mockResolvedValue(
      WINDOW_START_DATES.slice(0, 4).map((d, i) => ({
        exerciseName: "Back Squat",
        load: 100 + i * 5,
        loadUnit: "kg",
        reps: 5,
        sets: 3,
        createdAt: d,
      }))
    );
    mockThrowLogFindMany.mockResolvedValue(
      WINDOW_START_DATES.slice(0, 4).map((d, i) => ({
        event: "HAMMER",
        distance: 60 + i * 0.5,
        implementWeight: 7.26,
        date: new Date(d.getTime() + 5 * 86400000),
        isCompetition: false,
        isFoul: false,
        isPass: false,
      }))
    );
    const result = await liftThrowAnalyzer.analyze("a1");
    expect(result).toEqual([]);
  });

  it("emits insight with r≥0.4 on 6+ paired windows", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["HAMMER"] });
    mockLiftingLogFindMany.mockResolvedValue(
      WINDOW_START_DATES.map((d, i) => ({
        exerciseName: "Back Squat",
        load: 100 + i * 5, // monotonic increase
        loadUnit: "kg",
        reps: 3,
        sets: 3,
        createdAt: d,
      }))
    );
    mockThrowLogFindMany.mockResolvedValue(
      WINDOW_START_DATES.map((d, i) => ({
        event: "HAMMER",
        distance: 60 + i * 0.3, // monotonic increase → Pearson r = 1
        implementWeight: 7.26,
        date: new Date(d.getTime() + 5 * 86400000),
        isCompetition: false,
        isFoul: false,
        isPass: false,
      }))
    );
    const result = await liftThrowAnalyzer.analyze("a1");
    const hammer = result.find((r) => r.renderInputs.lift === "BACK_SQUAT" && r.event === "HAMMER");
    expect(hammer).toBeDefined();
    expect(hammer!.confidenceBand).toBe("WEAK"); // 8 paired → WEAK (6-9)
    expect(hammer!.coefficient).toBeGreaterThan(0.9);
    expect(hammer!.effectSize).toBeGreaterThan(0);
    expect(hammer!.effectUnit).toBe("meters per kg");
    expect(["1RM", "3RM"]).toContain(hammer!.renderInputs.repMaxBasis);
  });

  it("converts lbs to kg before bucketing", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["HAMMER"] });
    mockLiftingLogFindMany.mockResolvedValue(
      WINDOW_START_DATES.map((d, i) => ({
        exerciseName: "Back Squat",
        load: 225 + i * 10, // lbs
        loadUnit: "lbs",
        reps: 3,
        sets: 3,
        createdAt: d,
      }))
    );
    mockThrowLogFindMany.mockResolvedValue(
      WINDOW_START_DATES.map((d, i) => ({
        event: "HAMMER",
        distance: 60 + i * 0.3,
        implementWeight: 7.26,
        date: new Date(d.getTime() + 5 * 86400000),
        isCompetition: false,
        isFoul: false,
        isPass: false,
      }))
    );
    const result = await liftThrowAnalyzer.analyze("a1");
    const hammer = result.find((r) => r.event === "HAMMER");
    expect(hammer).toBeDefined();
    expect(hammer!.effectUnit).toBe("meters per kg");
  });

  it("excludes hang variants via canonicalLift", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["HAMMER"] });
    mockLiftingLogFindMany.mockResolvedValue(
      WINDOW_START_DATES.map((d, i) => ({
        exerciseName: "Hang Power Clean",
        load: 80 + i * 2,
        loadUnit: "kg",
        reps: 3,
        sets: 3,
        createdAt: d,
      }))
    );
    mockThrowLogFindMany.mockResolvedValue(
      WINDOW_START_DATES.map((d, i) => ({
        event: "HAMMER",
        distance: 60 + i * 0.3,
        implementWeight: 7.26,
        date: new Date(d.getTime() + 5 * 86400000),
        isCompetition: false,
        isFoul: false,
        isPass: false,
      }))
    );
    const result = await liftThrowAnalyzer.analyze("a1");
    expect(result).toEqual([]);
  });
});
