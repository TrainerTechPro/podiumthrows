import { describe, it, expect } from "vitest";
import {
  renderReadinessCompetition,
  type ReadinessCompetitionEvidence,
} from "../readinessCompetition";
import type { StructuredInsight } from "../../types";

function baseFixture(
  overrides: Partial<StructuredInsight<ReadinessCompetitionEvidence>> = {}
): StructuredInsight<ReadinessCompetitionEvidence> {
  return {
    category: "READINESS_COMPETITION",
    metric: "sleepQuality.shot_put",
    event: "SHOT_PUT",
    confidenceBand: "MEDIUM",
    dataPoints: 6,
    coefficient: -0.55,
    effectSize: -1.2, // meters (below-median minus above-median mean delta)
    effectUnit: "meters",
    evidence: {} as ReadinessCompetitionEvidence,
    renderInputs: { factor: "sleepQuality", direction: "negative", thresholdLabel: "below 6/10" },
    ...overrides,
  };
}

describe("renderReadinessCompetition", () => {
  it("negative — sleep quality — MEDIUM", () => {
    expect(renderReadinessCompetition(baseFixture())).toEqual({
      title: "Sleep quality affects your shot put meets",
      body: "Your shot put meets go roughly 1.2m worse when sleep quality is below 6/10 in the 3 days before.",
      detail: "Pattern strength: Medium — based on 6 competitions.",
    });
  });

  it("positive — HRV — STRONG", () => {
    expect(
      renderReadinessCompetition(
        baseFixture({
          confidenceBand: "STRONG",
          dataPoints: 10,
          effectSize: 1.4,
          event: "HAMMER",
          metric: "hrvMs.hammer",
          renderInputs: { factor: "hrvMs", direction: "positive", thresholdLabel: "above median" },
        })
      )
    ).toEqual({
      title: "HRV affects your hammer meets",
      body: "Your hammer meets go roughly 1.4m better when hrv is above median in the 3 days before.",
      detail: "Pattern strength: Strong — based on 10 competitions.",
    });
  });
});
