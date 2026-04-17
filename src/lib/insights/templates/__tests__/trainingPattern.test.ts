import { describe, it, expect } from "vitest";
import { renderTrainingPattern } from "../trainingPattern";
import type { TrainingPatternEvidence } from "../trainingPattern";
import type { StructuredInsight } from "../../types";

function baseFixture(
  overrides: Partial<StructuredInsight<TrainingPatternEvidence>> = {}
): StructuredInsight<TrainingPatternEvidence> {
  return {
    category: "TRAINING_PATTERN",
    metric: "exerciseUsage.shot_put.8kg_shot",
    event: "SHOT_PUT",
    confidenceBand: "MEDIUM",
    dataPoints: 12,
    coefficient: 0.68,
    effectSize: null,
    effectUnit: null,
    evidence: {} as TrainingPatternEvidence,
    renderInputs: { exercise: "8kg Shot", direction: "positive", sessionsObserved: 12 },
    ...overrides,
  };
}

describe("renderTrainingPattern", () => {
  it("positive direction — MEDIUM confidence", () => {
    expect(renderTrainingPattern(baseFixture())).toEqual({
      title: "Your best shot put throws follow 8kg shot weeks",
      body: "Weeks with more 8kg shot sessions tend to produce your stronger throws at competition weight.",
      detail: "Pattern strength: Medium — based on 12 weeks of data.",
    });
  });

  it("negative direction — STRONG confidence", () => {
    expect(
      renderTrainingPattern(
        baseFixture({
          confidenceBand: "STRONG",
          dataPoints: 24,
          renderInputs: { exercise: "6kg Shot", direction: "negative", sessionsObserved: 24 },
        })
      )
    ).toEqual({
      title: "Your shot put throws dip during 6kg shot weeks",
      body: "Weeks heavy on 6kg shot tend to precede your weaker sessions at competition weight.",
      detail: "Pattern strength: Strong — based on 24 weeks of data.",
    });
  });

  it("different event — HAMMER", () => {
    const result = renderTrainingPattern(
      baseFixture({
        event: "HAMMER",
        metric: "exerciseUsage.hammer.heavy_turns",
        renderInputs: { exercise: "Heavy Turns", direction: "positive", sessionsObserved: 8 },
        confidenceBand: "WEAK",
        dataPoints: 8,
      })
    );
    expect(result.title).toBe("Your best hammer throws follow heavy turns weeks");
    expect(result.detail).toBe("Pattern strength: Weak — based on 8 weeks of data.");
  });
});
