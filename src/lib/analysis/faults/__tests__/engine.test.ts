import { describe, it, expect } from "vitest";
import type { MetricsOutput } from "@/lib/contracts";
import { evaluateFaults, loadShotPutRules } from "../engine";

function metricsWith(
  metrics: MetricsOutput["metrics"]
): MetricsOutput {
  return {
    schemaVersion: "1.0",
    event: "SHOT_PUT",
    definitionsVersion: "shotput-1.0.0",
    calibrated: true,
    metrics,
    phaseBoundaries: [],
    quality: { meanQuality: 0.9, lowConfidence: false },
  };
}

describe("rules file", () => {
  it("parses against the contract and contains the PRD example rule", () => {
    const rules = loadShotPutRules();
    expect(rules.version).toBe("shotput-rules-1.0.0");
    const example = rules.rules.find((r) => r.ruleId === "early_shoulder_opening");
    expect(example).toBeDefined();
    expect(example!.metricKey).toBe("hip_shoulder_separation_at_power_position");
    expect(example!.comparator).toBe("below");
  });
});

describe("evaluateFaults", () => {
  it("fires the PRD example: separation 18° vs target 35–45 → HIGH, with evidence", () => {
    const faults = evaluateFaults(
      metricsWith({
        hip_shoulder_separation_at_power_position: {
          value: 18,
          unit: "deg",
          confidence: 0.9,
          frameRefs: [45],
        },
      })
    );
    expect(faults).toHaveLength(1);
    expect(faults[0]).toMatchObject({
      ruleId: "early_shoulder_opening",
      severity: "HIGH", // deviation 35−18 = 17 ≥ 15
      measuredValue: 18,
      targetRange: [35, 45],
      evidenceFrames: [45],
      drillTags: ["separation"],
      unit: "deg",
    });
  });

  it("maps severity by deviation band (LOW at 1° under, MEDIUM at 9° under)", () => {
    const low = evaluateFaults(
      metricsWith({
        hip_shoulder_separation_at_power_position: {
          value: 34, unit: "deg", confidence: 0.9, frameRefs: [45],
        },
      })
    );
    expect(low[0].severity).toBe("LOW");
    const med = evaluateFaults(
      metricsWith({
        hip_shoulder_separation_at_power_position: {
          value: 26, unit: "deg", confidence: 0.9, frameRefs: [45],
        },
      })
    );
    expect(med[0].severity).toBe("MEDIUM");
  });

  it("never fires on in-range, null, or low-confidence metrics", () => {
    expect(
      evaluateFaults(
        metricsWith({
          hip_shoulder_separation_at_power_position: {
            value: 40, unit: "deg", confidence: 0.9, frameRefs: [45],
          },
        })
      )
    ).toHaveLength(0);
    expect(
      evaluateFaults(
        metricsWith({
          hip_shoulder_separation_at_power_position: {
            value: null, unit: "deg", confidence: 0, frameRefs: [],
          },
        })
      )
    ).toHaveLength(0);
    expect(
      evaluateFaults(
        metricsWith({
          hip_shoulder_separation_at_power_position: {
            value: 18, unit: "deg", confidence: 0.3, frameRefs: [45],
          },
        })
      )
    ).toHaveLength(0);
  });

  it("handles above and outside comparators", () => {
    const faults = evaluateFaults(
      metricsWith({
        release_angle: { value: 47, unit: "deg", confidence: 0.9, frameRefs: [60] },
      })
    );
    expect(faults.map((f) => f.ruleId)).toEqual(["high_release_angle"]);
    expect(faults[0].severity).toBe("MEDIUM"); // 47 − 40 = 7 ≥ 5
  });

  it("rejects a rules/metrics event mismatch loudly", () => {
    const metrics = { ...metricsWith({}), event: "HAMMER" as const };
    expect(() => evaluateFaults(metrics)).toThrow(/Rules file is for SHOT_PUT/);
  });
});
