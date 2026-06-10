import { describe, it, expect, vi } from "vitest";
import type { NarrativeInput, NarrativeOutput } from "@/lib/contracts";
import { validateNarrative, collectAllowedNumbers } from "../numeral-validator";
import { templateNarrative } from "../templates";
import { generateNarrative } from "../claude";

const input: NarrativeInput = {
  event: "SHOT_PUT",
  athleteContext: { level: "D1", recentFaultIds: [] },
  metrics: {
    hip_shoulder_separation_at_power_position: {
      value: 18,
      unit: "deg",
      confidence: 0.9,
      frameRefs: [45],
    },
    release_velocity: { value: 10.5, unit: "m/s", confidence: 0.8, frameRefs: [60] },
  },
  faults: [
    {
      ruleId: "early_shoulder_opening",
      severity: "HIGH",
      measuredValue: 18,
      targetRange: [35, 45],
      evidenceFrames: [45],
      drillTags: ["separation"],
      faultName: "Early shoulder opening",
      metricKey: "hip_shoulder_separation_at_power_position",
      unit: "deg",
    },
  ],
  drillOptions: [
    { id: "drill_sep_1", name: "Separation med-ball wrap", description: null, tags: ["separation"] },
  ],
};

const goodOutput: NarrativeOutput = {
  coachSummary: "Separation measured 18 against a target of 35 to 45.",
  phaseCommentary: [{ phase: "power_position", comment: "Separation was 18." }],
  drillSelections: [{ drillId: "drill_sep_1", rationale: "Targets the 18 separation reading." }],
};

describe("collectAllowedNumbers", () => {
  it("collects numbers from values, ranges, frameRefs and strings", () => {
    const allowed = collectAllowedNumbers(input);
    for (const n of [18, 35, 45, 10.5, 60, 0.9, 0.8]) {
      expect(allowed.has(n), String(n)).toBe(true);
    }
    expect(allowed.has(99)).toBe(false);
  });
});

describe("validateNarrative", () => {
  it("accepts output whose numerals all exist in the input", () => {
    expect(validateNarrative(goodOutput, input)).toEqual({ ok: true, violations: [] });
  });

  it("rejects an invented numeral (the ThrowFlow confabulation case)", () => {
    const bad = { ...goodOutput, coachSummary: "You lost 23 percent of power." };
    const r = validateNarrative(bad, input);
    expect(r.ok).toBe(false);
    expect(r.violations[0]).toContain('"23"');
  });

  it("accepts numerically-equal reformatting (18.0 for 18) and rejects re-rounding", () => {
    const reformat = { ...goodOutput, coachSummary: "Separation was 18.0 today." };
    expect(validateNarrative(reformat, input).ok).toBe(true);
    const rounded = { ...goodOutput, coachSummary: "Velocity was about 11." };
    expect(validateNarrative(rounded, input).ok).toBe(false);
  });

  it("rejects a drill id not in the library", () => {
    const bad = {
      ...goodOutput,
      drillSelections: [{ drillId: "invented_drill", rationale: "Made up." }],
    };
    const r = validateNarrative(bad, input);
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.includes("invented_drill"))).toBe(true);
  });

  it("rejects a coachSummary over 120 words", () => {
    const bad = { ...goodOutput, coachSummary: Array(121).fill("word").join(" ") };
    const r = validateNarrative(bad, input);
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.includes("120-word"))).toBe(true);
  });
});

describe("templateNarrative (deterministic fallback)", () => {
  it("builds prose only from input values and passes its own validator", () => {
    const out = templateNarrative(input);
    expect(validateNarrative(out, input).ok).toBe(true);
    expect(out.coachSummary).toContain("18°");
    expect(out.coachSummary).toContain("35°–45°");
    expect(out.drillSelections).toEqual([
      { drillId: "drill_sep_1", rationale: expect.stringContaining("early shoulder opening") },
    ]);
  });

  it("is identical across runs", () => {
    expect(JSON.stringify(templateNarrative(input))).toBe(
      JSON.stringify(templateNarrative(input))
    );
  });
});

describe("generateNarrative orchestration", () => {
  it("returns claude output when validation passes first try", async () => {
    const callModel = vi.fn().mockResolvedValue(goodOutput);
    const r = await generateNarrative(input, { callModel });
    expect(r.source).toBe("claude");
    expect(r.validatorRetries).toBe(0);
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(callModel).toHaveBeenCalledWith(input, null);
  });

  it("retries once with violations quoted, then succeeds", async () => {
    const bad = { ...goodOutput, coachSummary: "Energy leak of 23 detected." };
    const callModel = vi
      .fn()
      .mockResolvedValueOnce(bad)
      .mockResolvedValueOnce(goodOutput);
    const r = await generateNarrative(input, { callModel });
    expect(r.source).toBe("claude");
    expect(r.validatorRetries).toBe(1);
    const correction = callModel.mock.calls[1][1] as string;
    expect(correction).toContain('"23"');
  });

  it("falls back to the template after two validation failures", async () => {
    const bad = { ...goodOutput, coachSummary: "You lost 23 percent." };
    const callModel = vi.fn().mockResolvedValue(bad);
    const r = await generateNarrative(input, { callModel });
    expect(r.source).toBe("template_fallback");
    expect(callModel).toHaveBeenCalledTimes(2);
    expect(validateNarrative(r.output, input).ok).toBe(true);
  });

  it("falls back immediately when the model call throws (no confabulation on errors)", async () => {
    const callModel = vi.fn().mockRejectedValue(new Error("api down"));
    const r = await generateNarrative(input, { callModel });
    expect(r.source).toBe("template_fallback");
    expect(callModel).toHaveBeenCalledTimes(1);
  });
});
