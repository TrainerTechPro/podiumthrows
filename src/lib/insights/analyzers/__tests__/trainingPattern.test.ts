import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAthleteFindUnique = vi.fn();
const mockSessionFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: { findUnique: (...a: unknown[]) => mockAthleteFindUnique(...a) },
    athleteThrowsSession: { findMany: (...a: unknown[]) => mockSessionFindMany(...a) },
  },
}));

vi.mock("@/lib/throws/engine/personal-correlations", () => ({
  computePersonalCorrelations: vi.fn(),
}));

import { computePersonalCorrelations } from "@/lib/throws/engine/personal-correlations";
import { trainingPatternAnalyzer } from "../trainingPattern";

describe("trainingPatternAnalyzer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] when athlete has no practice sessions", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["SHOT_PUT"] });
    mockSessionFindMany.mockResolvedValue([]);

    const result = await trainingPatternAnalyzer.analyze("a1");
    expect(result).toEqual([]);
  });

  it("returns [] when no correlations clear the 0.4 floor", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["SHOT_PUT"] });
    mockSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        event: "SHOT_PUT",
        date: "2026-01-01",
        drillLogs: [{ drillType: "Standing", throwCount: 10, bestMark: 18 }],
      },
    ]);
    vi.mocked(computePersonalCorrelations).mockReturnValue([
      {
        exercise: "Standing",
        blendedR: 0.2,
        personalR: 0.2,
        populationR: 0.2,
        dataPoints: 6,
        confidence: 0.1,
      },
    ]);

    const result = await trainingPatternAnalyzer.analyze("a1");
    expect(result).toEqual([]);
  });

  it("emits top 2 positive-direction insights per event", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["SHOT_PUT"] });
    mockSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        event: "SHOT_PUT",
        date: "2026-01-01",
        drillLogs: [{ drillType: "8kg Shot", throwCount: 20, bestMark: 17 }],
      },
      {
        id: "s2",
        event: "SHOT_PUT",
        date: "2026-01-08",
        drillLogs: [{ drillType: "8kg Shot", throwCount: 20, bestMark: 18 }],
      },
    ]);
    vi.mocked(computePersonalCorrelations).mockReturnValue([
      {
        exercise: "8kg Shot",
        blendedR: 0.75,
        personalR: 0.8,
        populationR: 0.6,
        dataPoints: 12,
        confidence: 0.6,
      },
      {
        exercise: "Standing",
        blendedR: 0.5,
        personalR: 0.4,
        populationR: 0.6,
        dataPoints: 12,
        confidence: 0.6,
      },
      {
        exercise: "Heavy Turns",
        blendedR: 0.3,
        personalR: 0.2,
        populationR: 0.4,
        dataPoints: 12,
        confidence: 0.6,
      },
    ]);

    const result = await trainingPatternAnalyzer.analyze("a1");
    expect(result).toHaveLength(2);
    expect(result[0].category).toBe("TRAINING_PATTERN");
    expect(result[0].metric).toBe("exerciseUsage.SHOT_PUT.8kg Shot");
    expect(result[0].event).toBe("SHOT_PUT");
    expect(result[0].confidenceBand).toBe("MEDIUM");
    expect(result[0].dataPoints).toBe(12);
    expect(result[0].coefficient).toBe(0.75);
    expect(result[0].renderInputs).toMatchObject({
      exercise: "8kg Shot",
      direction: "positive",
    });
  });

  it("uses STRONG band for 20+ data points", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["HAMMER"] });
    mockSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        event: "HAMMER",
        date: "2026-01-01",
        drillLogs: [{ drillType: "Full Turns", throwCount: 20, bestMark: 60 }],
      },
    ]);
    vi.mocked(computePersonalCorrelations).mockReturnValue([
      {
        exercise: "Full Turns",
        blendedR: 0.6,
        personalR: 0.7,
        populationR: 0.5,
        dataPoints: 24,
        confidence: 0.9,
      },
    ]);

    const result = await trainingPatternAnalyzer.analyze("a1");
    expect(result[0].confidenceBand).toBe("STRONG");
  });

  it("fans out across events", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["SHOT_PUT", "DISCUS"] });
    mockSessionFindMany.mockImplementation((args: { where?: { event?: string } }) => {
      const event = args.where?.event;
      return Promise.resolve([
        {
          id: `s-${event}`,
          event,
          date: "2026-01-01",
          drillLogs: [{ drillType: `Ex-${event}`, throwCount: 10, bestMark: 15 }],
        },
      ]);
    });
    vi.mocked(computePersonalCorrelations).mockReturnValue([
      {
        exercise: "TopExercise",
        blendedR: 0.7,
        personalR: 0.7,
        populationR: 0.7,
        dataPoints: 12,
        confidence: 0.5,
      },
    ]);

    const result = await trainingPatternAnalyzer.analyze("a1");
    expect(result).toHaveLength(2);
    expect(new Set(result.map((r) => r.event))).toEqual(new Set(["SHOT_PUT", "DISCUS"]));
  });
});
