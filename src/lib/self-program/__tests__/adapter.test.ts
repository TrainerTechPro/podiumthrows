import { describe, it, expect } from "vitest";
import { buildProgramConfig } from "../adapter";
import { DEFAULT_FACILITIES, DEFAULT_LIFTING_PRS, DEFAULT_TYPING } from "../defaults";
import type { TypingSnapshot } from "@/lib/throws/engine/types";

// ── Helper: minimal valid SelfProgramConfig shape ──────────────────

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    athleteProfileId: "athlete-1",
    trainingProgramId: null as string | null,
    programType: "THROWS_AND_LIFTING",
    event: "SHOT_PUT",
    gender: "MALE",
    yearsExperience: 5,
    competitionLevel: "COLLEGIATE",
    currentPR: 16.5,
    goalDistance: 18.0,
    currentWeeklyVolume: 150,
    availableImplements: [
      { weightKg: 9, type: "shot" },
      { weightKg: 7.26, type: "shot" },
      { weightKg: 6, type: "shot" },
    ],
    daysPerWeek: 4,
    sessionsPerDay: 1,
    preferredDays: ["MONDAY", "TUESDAY", "THURSDAY", "FRIDAY"],
    startDate: new Date("2026-04-01"),
    competitionDates: null as unknown,
    primaryGoal: "DISTANCE",
    generationMode: "AUTOPILOT",
    exercisePreferences: null as unknown,
    usedExistingTyping: false,
    inlineTypingData: null as unknown,
    isActive: true,
    isDraft: false,
    generationCount: 0,
    currentPhaseIndex: 0,
    ...overrides,
  };
}

describe("buildProgramConfig", () => {
  // ── Event / Gender Code Mapping ─────────────────────────────────

  it("maps SHOT_PUT to SP and MALE to M", () => {
    const result = buildProgramConfig(makeConfig(), null, null);
    expect(result.event).toBe("SHOT_PUT");
    expect(result.eventCode).toBe("SP");
    expect(result.gender).toBe("MALE");
    expect(result.genderCode).toBe("M");
  });

  it("maps DISCUS to DT and FEMALE to F", () => {
    const result = buildProgramConfig(
      makeConfig({ event: "DISCUS", gender: "FEMALE", currentPR: 50 }),
      null,
      null,
    );
    expect(result.eventCode).toBe("DT");
    expect(result.genderCode).toBe("F");
  });

  it("maps HAMMER to HT", () => {
    const result = buildProgramConfig(
      makeConfig({ event: "HAMMER", currentPR: 55 }),
      null,
      null,
    );
    expect(result.eventCode).toBe("HT");
  });

  it("maps JAVELIN to JT", () => {
    const result = buildProgramConfig(
      makeConfig({ event: "JAVELIN", currentPR: 65 }),
      null,
      null,
    );
    expect(result.eventCode).toBe("JT");
  });

  // ── Distance Band ──────────────────────────────────────────────

  it("derives distanceBand from PR using classifyBand", () => {
    // Male shot put 16.5m should fall into "16-17" band
    const result = buildProgramConfig(makeConfig(), null, null);
    expect(result.distanceBand).toBe("16-17");
  });

  it("returns highest band for PR above all bands", () => {
    const result = buildProgramConfig(makeConfig({ currentPR: 22 }), null, null);
    expect(result.distanceBand).toBe("20-21");
  });

  // ── Target Date ────────────────────────────────────────────────

  it("uses first A-meet as targetDate when competitions exist", () => {
    const config = makeConfig({
      competitionDates: [
        { date: "2026-06-15", name: "Conference", priority: "B_MEET" },
        { date: "2026-07-01", name: "Nationals", priority: "A_MEET" },
        { date: "2026-08-01", name: "Worlds", priority: "A_MEET" },
      ],
    });
    const result = buildProgramConfig(config, null, null);
    expect(result.targetDate).toBe("2026-07-01");
  });

  it("defaults targetDate to startDate + 16 weeks when no competitions", () => {
    const config = makeConfig({
      startDate: new Date("2026-04-01"),
      competitionDates: null,
    });
    const result = buildProgramConfig(config, null, null);
    // 2026-04-01 + 16 weeks (112 days) = 2026-07-22
    expect(result.targetDate).toBe("2026-07-22");
  });

  it("defaults targetDate to startDate + 16 weeks when no A-meet", () => {
    const config = makeConfig({
      startDate: new Date("2026-04-01"),
      competitionDates: [
        { date: "2026-06-15", name: "Invitational", priority: "B_MEET" },
      ],
    });
    const result = buildProgramConfig(config, null, null);
    expect(result.targetDate).toBe("2026-07-22");
  });

  // ── Typing Resolution ──────────────────────────────────────────

  it("uses existing typing data when provided", () => {
    const existingTyping: TypingSnapshot = {
      adaptationGroup: 1,
      sessionsToForm: 12,
      recommendedMethod: "concentrated",
      transferType: "fast",
      selfFeelingAccuracy: "high",
      recoveryProfile: "fast",
    };
    const result = buildProgramConfig(makeConfig(), existingTyping, null);
    expect(result.adaptationGroup).toBe(1);
    expect(result.sessionsToForm).toBe(12);
    expect(result.recommendedMethod).toBe("concentrated");
    expect(result.transferType).toBe("fast");
    expect(result.recoveryProfile).toBe("fast");
  });

  it("uses inline typing data when no existing typing", () => {
    const config = makeConfig({
      inlineTypingData: {
        adaptationGroup: 3,
        sessionsToForm: 36,
        recommendedMethod: "sequential",
        transferType: "slow",
        selfFeelingAccuracy: "low",
        recoveryProfile: "slow",
      },
    });
    const result = buildProgramConfig(config, null, null);
    expect(result.adaptationGroup).toBe(3);
    expect(result.sessionsToForm).toBe(36);
    expect(result.recommendedMethod).toBe("sequential");
  });

  it("falls back to DEFAULT_TYPING when no typing data at all", () => {
    const config = makeConfig({ inlineTypingData: null, usedExistingTyping: false });
    const result = buildProgramConfig(config, null, null);
    expect(result.adaptationGroup).toBe(DEFAULT_TYPING.adaptationGroup);
    expect(result.sessionsToForm).toBe(DEFAULT_TYPING.sessionsToForm);
    expect(result.recommendedMethod).toBe(DEFAULT_TYPING.recommendedMethod);
  });

  // ── Program Type → includeLift ─────────────────────────────────

  it("sets includeLift to true for THROWS_AND_LIFTING", () => {
    const result = buildProgramConfig(
      makeConfig({ programType: "THROWS_AND_LIFTING" }),
      null,
      null,
    );
    expect(result.includeLift).toBe(true);
  });

  it("sets includeLift to false for THROWS_ONLY", () => {
    const result = buildProgramConfig(
      makeConfig({ programType: "THROWS_ONLY" }),
      null,
      null,
    );
    expect(result.includeLift).toBe(false);
  });

  // ── Facilities ─────────────────────────────────────────────────

  it("uses DEFAULT_FACILITIES", () => {
    const result = buildProgramConfig(makeConfig(), null, null);
    expect(result.facilities).toEqual(DEFAULT_FACILITIES);
  });

  // ── Lifting PRs from performanceBenchmarks ─────────────────────

  it("parses performanceBenchmarks JSON into liftingPrs", () => {
    const benchmarks = JSON.stringify({
      squat1RM: 180,
      bench1RM: 130,
      clean1RM: 120,
      snatch1RM: 95,
      ohp1RM: 80,
      deadlift1RM: 200,
    });
    const result = buildProgramConfig(makeConfig(), null, benchmarks, 90);
    expect(result.liftingPrs).toEqual({
      squatKg: 180,
      benchKg: 130,
      cleanKg: 120,
      snatchKg: 95,
      ohpKg: 80,
      deadliftKg: 200,
      bodyWeightKg: 90,
    });
  });

  it("uses DEFAULT_LIFTING_PRS when no benchmarks", () => {
    const result = buildProgramConfig(makeConfig(), null, null);
    expect(result.liftingPrs).toEqual(DEFAULT_LIFTING_PRS);
  });

  it("uses bodyWeightKg override when provided with no benchmarks", () => {
    const result = buildProgramConfig(makeConfig(), null, null, 95);
    expect(result.liftingPrs.bodyWeightKg).toBe(95);
  });

  // ── Direct Field Mapping ───────────────────────────────────────

  it("maps direct fields correctly", () => {
    const result = buildProgramConfig(makeConfig(), null, null);
    expect(result.competitionPr).toBe(16.5);
    expect(result.goalDistance).toBe(18.0);
    expect(result.daysPerWeek).toBe(4);
    expect(result.sessionsPerDay).toBe(1);
    expect(result.yearsThrowing).toBe(5);
    expect(result.currentWeeklyVolume).toBe(150);
    expect(result.startDate).toBe("2026-04-01");
  });

  it("maps availableImplements", () => {
    const result = buildProgramConfig(makeConfig(), null, null);
    expect(result.availableImplements).toEqual([
      { weightKg: 9, type: "shot" },
      { weightKg: 7.26, type: "shot" },
      { weightKg: 6, type: "shot" },
    ]);
  });
});
