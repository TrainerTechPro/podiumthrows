// src/lib/insights/__tests__/runInsights.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTrainingAnalyze, mockLiftAnalyze, mockReadinessAnalyze, mockPersist, mockLoggerError } =
  vi.hoisted(() => ({
    mockTrainingAnalyze: vi.fn(),
    mockLiftAnalyze: vi.fn(),
    mockReadinessAnalyze: vi.fn(),
    mockPersist: vi.fn(),
    mockLoggerError: vi.fn(),
  }));

vi.mock("../analyzers/trainingPattern", () => ({
  trainingPatternAnalyzer: {
    category: "TRAINING_PATTERN",
    analyze: (...a: unknown[]) => mockTrainingAnalyze(...a),
  },
}));
vi.mock("../analyzers/liftThrowCorrelation", () => ({
  liftThrowAnalyzer: {
    category: "LIFT_THROW",
    analyze: (...a: unknown[]) => mockLiftAnalyze(...a),
  },
}));
vi.mock("../analyzers/readinessCompetition", () => ({
  readinessCompetitionAnalyzer: {
    category: "READINESS_COMPETITION",
    analyze: (...a: unknown[]) => mockReadinessAnalyze(...a),
  },
}));
vi.mock("../persist", () => ({
  persistInsights: (...a: unknown[]) => mockPersist(...a),
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn() },
}));

vi.mock("../templates/trainingPattern", () => ({
  renderTrainingPattern: (i: { metric: string }) => ({
    title: `T:${i.metric}`,
    body: `Tb`,
    detail: `Td`,
  }),
}));
vi.mock("../templates/liftThrowCorrelation", () => ({
  renderLiftThrow: (i: { metric: string }) => ({
    title: `L:${i.metric}`,
    body: `Lb`,
    detail: `Ld`,
  }),
}));
vi.mock("../templates/readinessCompetition", () => ({
  renderReadinessCompetition: (i: { metric: string }) => ({
    title: `R:${i.metric}`,
    body: `Rb`,
    detail: `Rd`,
  }),
}));

import { runInsights } from "../runInsights";
import type { StructuredInsight } from "../types";

function structured(overrides: Partial<StructuredInsight> = {}): StructuredInsight {
  return {
    category: "TRAINING_PATTERN",
    metric: "m",
    event: null,
    confidenceBand: "MEDIUM",
    dataPoints: 10,
    coefficient: 0.5,
    effectSize: null,
    effectUnit: null,
    evidence: {},
    renderInputs: {},
    ...overrides,
  };
}

describe("runInsights", () => {
  beforeEach(() => vi.clearAllMocks());

  it("combines output from all three analyzers and calls persist once", async () => {
    mockTrainingAnalyze.mockResolvedValue([structured({ metric: "t1" })]);
    mockLiftAnalyze.mockResolvedValue([structured({ category: "LIFT_THROW", metric: "l1" })]);
    mockReadinessAnalyze.mockResolvedValue([
      structured({ category: "READINESS_COMPETITION", metric: "r1" }),
    ]);
    mockPersist.mockResolvedValue(3);

    const result = await runInsights({
      athleteId: "a1",
      trigger: "MEET_COMPLETE",
      triggerMeetId: "m1",
    });
    expect(result.persistedCount).toBe(3);
    expect(result.skippedAnalyzers).toEqual([]);
    expect(mockPersist).toHaveBeenCalledTimes(1);
    const persistArgs = mockPersist.mock.calls[0][1];
    expect(persistArgs).toHaveLength(3);
    expect(
      persistArgs.every(
        (r: { triggerKind: string; triggerMeetId: string }) =>
          r.triggerKind === "MEET_COMPLETE" && r.triggerMeetId === "m1"
      )
    ).toBe(true);
  });

  it("records skippedAnalyzers when analyzer returns []", async () => {
    mockTrainingAnalyze.mockResolvedValue([]);
    mockLiftAnalyze.mockResolvedValue([structured({ category: "LIFT_THROW", metric: "l1" })]);
    mockReadinessAnalyze.mockResolvedValue([]);
    mockPersist.mockResolvedValue(1);

    const result = await runInsights({ athleteId: "a1", trigger: "ON_DEMAND" });
    expect(result.skippedAnalyzers).toEqual(["TRAINING_PATTERN", "READINESS_COMPETITION"]);
  });

  it("one analyzer throwing does not block the others", async () => {
    mockTrainingAnalyze.mockRejectedValue(new Error("boom"));
    mockLiftAnalyze.mockResolvedValue([structured({ category: "LIFT_THROW", metric: "l1" })]);
    mockReadinessAnalyze.mockResolvedValue([
      structured({ category: "READINESS_COMPETITION", metric: "r1" }),
    ]);
    mockPersist.mockResolvedValue(2);

    const result = await runInsights({ athleteId: "a1", trigger: "ON_DEMAND" });
    expect(result.persistedCount).toBe(2);
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("persistedCount is 0 when all analyzers return []", async () => {
    mockTrainingAnalyze.mockResolvedValue([]);
    mockLiftAnalyze.mockResolvedValue([]);
    mockReadinessAnalyze.mockResolvedValue([]);
    mockPersist.mockResolvedValue(0);

    const result = await runInsights({ athleteId: "a1", trigger: "ON_DEMAND" });
    expect(result.persistedCount).toBe(0);
    expect(result.skippedAnalyzers).toEqual([
      "TRAINING_PATTERN",
      "LIFT_THROW",
      "READINESS_COMPETITION",
    ]);
  });
});
