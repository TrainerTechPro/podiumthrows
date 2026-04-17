import { describe, it, expect } from "vitest";
import { renderLiftThrow, type LiftThrowEvidence } from "../liftThrowCorrelation";
import type { StructuredInsight } from "../../types";

function baseFixture(
  overrides: Partial<StructuredInsight<LiftThrowEvidence>> = {}
): StructuredInsight<LiftThrowEvidence> {
  return {
    category: "LIFT_THROW",
    metric: "squat_1rm.hammer",
    event: "HAMMER",
    confidenceBand: "MEDIUM",
    dataPoints: 11,
    coefficient: 0.72,
    effectSize: 0.04, // meters per kg
    effectUnit: "meters per kg",
    evidence: {} as LiftThrowEvidence,
    renderInputs: { lift: "BACK_SQUAT", repMaxBasis: "1RM" },
    ...overrides,
  };
}

describe("renderLiftThrow", () => {
  it("back squat 1RM — hammer — MEDIUM", () => {
    // effectSize 0.04 m/kg → 0.5 m / 0.04 m/kg = 12.5 → rounds to 13 kg
    expect(renderLiftThrow(baseFixture())).toEqual({
      title: "Back Squat 1RM tracks with hammer distance",
      body: "Your back squat 1RM and hammer best-mark have moved together over the last months.",
      detail:
        "Roughly every 13kg of 1RM has tracked with ~0.5m of hammer distance. " +
        "Pattern strength: Medium — based on 11 paired windows.",
    });
  });

  it("3RM basis — snatch — STRONG", () => {
    // effectSize 0.02 m/kg → 0.5 / 0.02 = 25 kg
    expect(
      renderLiftThrow(
        baseFixture({
          confidenceBand: "STRONG",
          dataPoints: 18,
          effectSize: 0.02,
          renderInputs: { lift: "SNATCH", repMaxBasis: "3RM" },
          event: "DISCUS",
          metric: "snatch_3rm.discus",
        })
      )
    ).toEqual({
      title: "Snatch 3RM tracks with discus distance",
      body: "Your snatch 3RM and discus best-mark have moved together over the last months.",
      detail:
        "Roughly every 25kg of 3RM has tracked with ~0.5m of discus distance. " +
        "Pattern strength: Strong — based on 18 paired windows.",
    });
  });

  it("zero slope falls back to 0kg in copy", () => {
    const result = renderLiftThrow(
      baseFixture({ effectSize: 0, confidenceBand: "WEAK", dataPoints: 6 })
    );
    expect(result.detail).toContain("Roughly every 0kg of 1RM");
    expect(result.detail).toContain("Pattern strength: Weak — based on 6 paired windows.");
  });
});
