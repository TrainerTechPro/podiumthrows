// src/lib/insights/analyzers/__tests__/readinessCompetition.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAthleteFindUnique = vi.fn();
const mockCompFindMany = vi.fn();
const mockReadinessFindMany = vi.fn();
const mockGetAthletePRs = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: { findUnique: (...a: unknown[]) => mockAthleteFindUnique(...a) },
    throwsCompetition: { findMany: (...a: unknown[]) => mockCompFindMany(...a) },
    readinessCheckIn: { findMany: (...a: unknown[]) => mockReadinessFindMany(...a) },
  },
  prisma: {
    throwsCompetition: { findMany: (...a: unknown[]) => mockCompFindMany(...a) },
  },
}));

vi.mock("@/lib/data/personal-records", () => ({
  getAthletePRs: (...a: unknown[]) => mockGetAthletePRs(...a),
}));

vi.mock("react", () => ({ cache: <T>(fn: T) => fn }));

import { readinessCompetitionAnalyzer } from "../readinessCompetition";

function meet(date: string, bestMark: number, event = "SHOT_PUT") {
  return {
    id: `m-${date}`,
    athleteId: "a1",
    date,
    event,
    meetStatus: "COMPLETED",
    throws: [{ distance: bestMark, isFoul: false, isPass: false }],
  };
}

function ci(date: string, overrides: Record<string, number | null> = {}) {
  return {
    athleteId: "a1",
    date: new Date(date),
    sleepQuality: 7,
    sleepHours: 7.5,
    soreness: 3,
    stressLevel: 4,
    energyMood: 7,
    hrvMs: null,
    restingHR: null,
    whoopStrain: null,
    ...overrides,
  };
}

describe("readinessCompetitionAnalyzer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] with <4 completed meets", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["SHOT_PUT"] });
    mockCompFindMany.mockResolvedValue([
      meet("2026-01-15", 18),
      meet("2026-02-15", 18),
      meet("2026-03-15", 18),
    ]);
    mockReadinessFindMany.mockResolvedValue([]);
    mockGetAthletePRs.mockResolvedValue({
      events: [{ event: "SHOT_PUT", competitionPR: { distance: 19 } }],
    });

    const result = await readinessCompetitionAnalyzer.analyze("a1");
    expect(result).toEqual([]);
  });

  it("returns [] with no readiness check-ins", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["SHOT_PUT"] });
    mockCompFindMany.mockResolvedValue([
      meet("2026-01-15", 18),
      meet("2026-02-15", 18),
      meet("2026-03-15", 18),
      meet("2026-04-15", 18),
    ]);
    mockReadinessFindMany.mockResolvedValue([]);
    mockGetAthletePRs.mockResolvedValue({
      events: [{ event: "SHOT_PUT", competitionPR: { distance: 19 } }],
    });

    const result = await readinessCompetitionAnalyzer.analyze("a1");
    expect(result).toEqual([]);
  });

  it("emits insight when sleep quality correlates strongly with PR delta", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["SHOT_PUT"] });
    const meets = [
      { date: "2026-01-15", mark: 17.0, sleep: 4 },
      { date: "2026-02-15", mark: 19.0, sleep: 9 },
      { date: "2026-03-01", mark: 17.2, sleep: 4 },
      { date: "2026-03-15", mark: 19.2, sleep: 9 },
      { date: "2026-04-01", mark: 17.5, sleep: 5 },
      { date: "2026-04-15", mark: 18.8, sleep: 8 },
    ];
    mockCompFindMany.mockResolvedValue(meets.map((m) => meet(m.date, m.mark)));
    const allCheckIns = meets.flatMap((m) =>
      [1, 2, 3].map((offset) => {
        const d = new Date(m.date);
        d.setUTCDate(d.getUTCDate() - offset);
        return ci(d.toISOString(), { sleepQuality: m.sleep });
      })
    );
    mockReadinessFindMany.mockResolvedValue(allCheckIns);
    mockGetAthletePRs.mockResolvedValue({
      events: [{ event: "SHOT_PUT", competitionPR: { distance: 19.2 } }],
    });

    const result = await readinessCompetitionAnalyzer.analyze("a1");
    const sleep = result.find((r) => r.renderInputs.factor === "sleepQuality");
    expect(sleep).toBeDefined();
    expect(sleep!.confidenceBand).toBe("MEDIUM"); // 6 meets → MEDIUM (6-8)
    expect(Math.abs(sleep!.coefficient ?? 0)).toBeGreaterThan(0.9);
    expect(sleep!.renderInputs.direction).toBe("positive"); // higher sleep → better delta
    expect(sleep!.effectUnit).toBe("meters");
  });

  it("skips a factor when it has no data in ReadinessCheckIn rows", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["SHOT_PUT"] });
    const meets = Array.from({ length: 6 }, (_, i) => ({
      date: `2026-0${i + 1}-15`,
      mark: 18,
      sleep: 5 + (i % 2),
    }));
    mockCompFindMany.mockResolvedValue(meets.map((m) => meet(m.date, m.mark)));
    const allCheckIns = meets.flatMap((m) =>
      [1, 2, 3].map((offset) => {
        const d = new Date(m.date);
        d.setUTCDate(d.getUTCDate() - offset);
        return ci(d.toISOString(), { sleepQuality: m.sleep, hrvMs: null });
      })
    );
    mockReadinessFindMany.mockResolvedValue(allCheckIns);
    mockGetAthletePRs.mockResolvedValue({
      events: [{ event: "SHOT_PUT", competitionPR: { distance: 19 } }],
    });

    const result = await readinessCompetitionAnalyzer.analyze("a1");
    const hrv = result.find((r) => r.renderInputs.factor === "hrvMs");
    expect(hrv).toBeUndefined();
  });
});
