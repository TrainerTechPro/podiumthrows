import { describe, it, expect } from "vitest";
import { runArchitectAnalysis, type PhaseConflict } from "@/lib/bondarchuk/architect-engine";

/**
 * Phase C.2 — `lifestyle.stressBaseline` (Master Profile, 1-10 self-report)
 * surfaces a phase conflict when the athlete reports chronic high stress.
 *
 * Bondarchuk Volume IV doesn't prescribe a stress threshold, but the engine
 * pattern matches Phase C.1 (equipment): we don't change the prescription,
 * we add a coach-facing warning so the human owns the call. Threshold of 8
 * matches the wellness check-in's red-zone cutoff.
 */
describe("runArchitectAnalysis — stress-aware", () => {
  const baseInput = {
    name: "Test Athlete",
    event: "SHOT_PUT" as const,
    gender: "MALE" as const,
    pr: 19,
    daysToChampionship: 120,
    trainingPhase: "ACCUMULATION" as const,
    strengthNumbers: null,
  };

  function stressWarnings(conflicts: PhaseConflict[]) {
    return conflicts.filter((c) => c.message.toLowerCase().includes("stress"));
  }

  it("emits no stress conflict when lifestyleStressBaseline is omitted", () => {
    const result = runArchitectAnalysis(baseInput);
    expect(stressWarnings(result.context.phaseConflicts)).toEqual([]);
  });

  it("emits no stress conflict when lifestyleStressBaseline is null", () => {
    const result = runArchitectAnalysis({ ...baseInput, lifestyleStressBaseline: null });
    expect(stressWarnings(result.context.phaseConflicts)).toEqual([]);
  });

  it("emits no stress conflict at low stress (3/10)", () => {
    const result = runArchitectAnalysis({ ...baseInput, lifestyleStressBaseline: 3 });
    expect(stressWarnings(result.context.phaseConflicts)).toEqual([]);
  });

  it("emits no stress conflict at moderate stress (6/10)", () => {
    const result = runArchitectAnalysis({ ...baseInput, lifestyleStressBaseline: 6 });
    expect(stressWarnings(result.context.phaseConflicts)).toEqual([]);
  });

  it("emits no stress conflict at sub-threshold (7/10)", () => {
    const result = runArchitectAnalysis({ ...baseInput, lifestyleStressBaseline: 7 });
    expect(stressWarnings(result.context.phaseConflicts)).toEqual([]);
  });

  it("emits a warning at threshold (8/10)", () => {
    const result = runArchitectAnalysis({ ...baseInput, lifestyleStressBaseline: 8 });
    const warnings = stressWarnings(result.context.phaseConflicts);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe("warning");
    expect(warnings[0].message).toMatch(/8\/10/);
  });

  it("emits a stronger warning at very high stress (9-10/10)", () => {
    const result = runArchitectAnalysis({ ...baseInput, lifestyleStressBaseline: 10 });
    const warnings = stressWarnings(result.context.phaseConflicts);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe("warning");
    expect(warnings[0].message).toMatch(/10\/10/);
    // Stronger language at 9-10 — coach should consider load reduction
    expect(warnings[0].message.toLowerCase()).toMatch(/reduc|defer|deload/);
  });

  it("clamps out-of-range values gracefully (does not throw)", () => {
    expect(() => runArchitectAnalysis({ ...baseInput, lifestyleStressBaseline: -1 })).not.toThrow();
    expect(() => runArchitectAnalysis({ ...baseInput, lifestyleStressBaseline: 99 })).not.toThrow();
  });
});
