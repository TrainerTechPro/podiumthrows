import { describe, it, expect } from "vitest";
import {
  filterImplementSet,
  runArchitectAnalysis,
  type AvailableImplement,
} from "@/lib/bondarchuk/architect-engine";

const SHOT_18_20_MALE = { light: ["6kg"], competition: "7.26kg", heavy: ["8kg", "9kg"] };

describe("filterImplementSet", () => {
  it("returns canonical set when availableImplements is undefined", () => {
    const out = filterImplementSet(SHOT_18_20_MALE, "SHOT_PUT", undefined);
    expect(out.set).toEqual(SHOT_18_20_MALE);
    expect(out.missing.heavy).toEqual([]);
    expect(out.missing.light).toEqual([]);
  });

  it("returns canonical set when no available entries match the event type", () => {
    const onlyDiscus: AvailableImplement[] = [{ weightKg: 2, type: "disc" }];
    const out = filterImplementSet(SHOT_18_20_MALE, "SHOT_PUT", onlyDiscus);
    expect(out.set).toEqual(SHOT_18_20_MALE);
    expect(out.missing.heavy).toEqual([]);
  });

  it("narrows heavy[] to the intersection of canonical and owned", () => {
    const owns: AvailableImplement[] = [
      { weightKg: 6, type: "shot" },
      { weightKg: 7.26, type: "shot" },
      { weightKg: 8, type: "shot" }, // owns 8kg, not 9kg
    ];
    const out = filterImplementSet(SHOT_18_20_MALE, "SHOT_PUT", owns);
    expect(out.set.heavy).toEqual(["8kg"]);
    expect(out.set.light).toEqual(["6kg"]);
    expect(out.set.competition).toBe("7.26kg");
    expect(out.missing.heavy).toEqual([]);
  });

  it("falls back to canonical heavy[] + reports missing when athlete owns none", () => {
    const owns: AvailableImplement[] = [
      { weightKg: 6, type: "shot" },
      { weightKg: 7.26, type: "shot" },
    ];
    const out = filterImplementSet(SHOT_18_20_MALE, "SHOT_PUT", owns);
    // Falls back to canonical heavy so the session still has a defensible
    // plan — better than emitting a heavy block with no implements.
    expect(out.set.heavy).toEqual(["8kg", "9kg"]);
    expect(out.missing.heavy).toEqual(["8kg", "9kg"]);
  });

  it("ignores implements of the wrong throw type", () => {
    const owns: AvailableImplement[] = [
      { weightKg: 8, type: "hammer" }, // 8kg hammer, not 8kg shot
    ];
    const out = filterImplementSet(SHOT_18_20_MALE, "SHOT_PUT", owns);
    // No matching shot implements → no filter applied at all.
    expect(out.set).toEqual(SHOT_18_20_MALE);
  });

  it("matches javelin gram labels (900g) against kg-typed inventory (0.9kg)", () => {
    const javSet = { light: ["600g", "700g"], competition: "800g", heavy: ["900g", "1kg"] };
    const owns: AvailableImplement[] = [
      { weightKg: 0.7, type: "jav" },
      { weightKg: 0.8, type: "jav" },
      { weightKg: 0.9, type: "jav" },
    ];
    const out = filterImplementSet(javSet, "JAVELIN", owns);
    // Heavy narrows to "900g" (athlete owns 0.9kg, not 1kg).
    expect(out.set.heavy).toEqual(["900g"]);
    // Light narrows to "700g" (athlete owns 0.7kg, not 0.6kg).
    expect(out.set.light).toEqual(["700g"]);
    expect(out.missing.heavy).toEqual([]);
    expect(out.missing.light).toEqual([]);
  });

  it("light bucket falls back to canonical when filter empties it", () => {
    const javSet = { light: ["600g"], competition: "800g", heavy: ["900g", "1kg"] };
    const owns: AvailableImplement[] = [
      { weightKg: 0.8, type: "jav" },
      { weightKg: 0.9, type: "jav" },
    ];
    const out = filterImplementSet(javSet, "JAVELIN", owns);
    expect(out.set.light).toEqual(["600g"]);
    expect(out.missing.light).toEqual(["600g"]);
  });
});

describe("runArchitectAnalysis (equipment-aware)", () => {
  const baseInput = {
    name: "Test Athlete",
    event: "SHOT_PUT" as const,
    gender: "MALE" as const,
    pr: 19, // → 18-20m band
    daysToChampionship: 120,
    trainingPhase: "ACCUMULATION" as const,
    strengthNumbers: null,
  };

  it("emits no equipment phase conflict when canonical heavy is owned", () => {
    const owns: AvailableImplement[] = [
      { weightKg: 6, type: "shot" },
      { weightKg: 7.26, type: "shot" },
      { weightKg: 8, type: "shot" },
      { weightKg: 9, type: "shot" },
    ];
    const result = runArchitectAnalysis({ ...baseInput, availableImplements: owns });
    const equipmentWarnings = result.context.phaseConflicts.filter((c) =>
      c.message.includes("equipment inventory")
    );
    expect(equipmentWarnings).toEqual([]);
  });

  it("emits a heavy-missing warning when athlete owns none of the heavy weights", () => {
    const owns: AvailableImplement[] = [
      { weightKg: 6, type: "shot" },
      { weightKg: 7.26, type: "shot" },
    ];
    const result = runArchitectAnalysis({ ...baseInput, availableImplements: owns });
    const heavyWarning = result.context.phaseConflicts.find(
      (c) => c.message.includes("heavy implement") && c.message.includes("equipment")
    );
    expect(heavyWarning).toBeDefined();
    expect(heavyWarning!.type).toBe("warning");
  });

  it("uses the narrowed heavy[] in session block 1 when the athlete owns a subset", () => {
    const owns: AvailableImplement[] = [
      { weightKg: 6, type: "shot" },
      { weightKg: 7.26, type: "shot" },
      { weightKg: 8, type: "shot" }, // canonical heavy is [8, 9]; athlete owns only 8
    ];
    const result = runArchitectAnalysis({ ...baseInput, availableImplements: owns });
    const block1 = result.sessionStructure.blocks[0];
    expect(block1.type).toBe("THROWING");
    const weights = block1.implements?.map((i) => i.weight) ?? [];
    // Block 1 prescribes the first 2 heavy weights — narrowed list has
    // only "8kg", so block 1 carries one implement.
    expect(weights).toEqual(["8kg"]);
  });

  it("preserves legacy behavior when availableImplements omitted", () => {
    const result = runArchitectAnalysis(baseInput);
    const block1 = result.sessionStructure.blocks[0];
    const weights = block1.implements?.map((i) => i.weight) ?? [];
    // Canonical heavy for SHOT_PUT MALE 18-20m is ["8kg", "9kg"], block 1
    // prescribes the first 2.
    expect(weights).toEqual(["8kg", "9kg"]);
  });
});
