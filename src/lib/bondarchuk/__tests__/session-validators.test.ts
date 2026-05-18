import { describe, it, expect } from "vitest";
import {
  validateImplementSequence,
  validateBlockStructure,
  validateCrossBlockSequence,
  validateWeightDifferential,
  validateFullSession,
  type BlockInput,
} from "@/lib/bondarchuk/session-validators";

function throwingBlock(name: string, kgs: number[]): BlockInput {
  return {
    name,
    blockType: "throwing",
    exercises: kgs.map((kg, i) => ({ name: `${kg}kg throw #${i + 1}`, implementKg: kg })),
  };
}

function strengthBlock(name: string): BlockInput {
  return { name, blockType: "strength", exercises: [{ name: "Back Squat" }] };
}

function warmupBlock(name = "Warmup"): BlockInput {
  return { name, blockType: "warmup", exercises: [{ name: "Mobility" }] };
}

// ── validateImplementSequence (session-level) ───────────────────────────

describe("session-validators: validateImplementSequence", () => {
  it("accepts a single throwing block with descending weights", () => {
    const result = validateImplementSequence([throwingBlock("B1", [9, 8, 7.26])]);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("accepts a single implement (no sequence to validate)", () => {
    const result = validateImplementSequence([throwingBlock("B1", [7.26])]);
    expect(result.valid).toBe(true);
  });

  it("rejects ascending weights within a throwing block", () => {
    const result = validateImplementSequence([throwingBlock("B1", [6, 8])]);
    expect(result.valid).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].type).toBe("ascending_weight");
    expect(result.warnings[0].severity).toBe("error");
    expect(result.warnings[0].blockIndex).toBe(0);
  });

  it("ignores non-throwing blocks", () => {
    const result = validateImplementSequence([
      strengthBlock("Lifts"), // has no implementKg — should not trigger anything
      warmupBlock(),
    ]);
    expect(result.valid).toBe(true);
  });

  it("reports per-block for multiple throwing blocks", () => {
    const result = validateImplementSequence([
      throwingBlock("B1", [8, 7.26]),
      strengthBlock("Lifts"),
      throwingBlock("B2", [5, 7]), // ascending — error
    ]);
    expect(result.valid).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].blockIndex).toBe(2);
  });

  it("surfaces the offending exercise index", () => {
    const result = validateImplementSequence([throwingBlock("B1", [8, 7.26, 9])]);
    expect(result.valid).toBe(false);
    // Third exercise (index 2) is the offender
    expect(result.warnings[0].exerciseIndex).toBe(2);
  });
});

// ── validateBlockStructure ──────────────────────────────────────────────

describe("session-validators: validateBlockStructure", () => {
  it("accepts throwing → strength → throwing (Bondarchuk canonical)", () => {
    const result = validateBlockStructure([
      throwingBlock("B1", [8]),
      strengthBlock("Lifts"),
      throwingBlock("B2", [7.26]),
    ]);
    expect(result.valid).toBe(true);
  });

  it("rejects two consecutive throwing blocks", () => {
    const result = validateBlockStructure([throwingBlock("B1", [8]), throwingBlock("B2", [7.26])]);
    expect(result.valid).toBe(false);
    expect(result.warnings[0].type).toBe("consecutive_throwing");
  });

  it("treats warmup and cooldown as non-separators (they should not count)", () => {
    const result = validateBlockStructure([
      throwingBlock("B1", [8]),
      warmupBlock(),
      throwingBlock("B2", [7.26]),
    ]);
    expect(result.valid).toBe(false);
  });

  it("accepts a single throwing block", () => {
    expect(validateBlockStructure([throwingBlock("B1", [8])]).valid).toBe(true);
  });
});

// ── validateCrossBlockSequence ──────────────────────────────────────────

describe("session-validators: validateCrossBlockSequence", () => {
  it("accepts equal-or-lighter later throwing block", () => {
    const result = validateCrossBlockSequence([
      throwingBlock("B1", [8]),
      strengthBlock("Lifts"),
      throwingBlock("B2", [7.26]),
    ]);
    expect(result.valid).toBe(true);
  });

  it("flags heavier later throwing block as a warning", () => {
    const result = validateCrossBlockSequence([
      throwingBlock("B1", [7.26]),
      strengthBlock("Lifts"),
      throwingBlock("B2", [8]),
    ]);
    expect(result.valid).toBe(false);
    expect(result.warnings[0].type).toBe("cross_block_ascending");
    expect(result.warnings[0].severity).toBe("warning");
  });
});

// ── validateWeightDifferential ──────────────────────────────────────────

describe("session-validators: validateWeightDifferential", () => {
  it("accepts an in-window drop (8 → 7.26 ≈ 9%)", () => {
    const result = validateWeightDifferential([throwingBlock("B1", [8, 7.26])]);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("accepts repeated identical weights (0% diff)", () => {
    const result = validateWeightDifferential([throwingBlock("B1", [7.26, 7.26, 7.26])]);
    expect(result.valid).toBe(true);
  });

  it("flags a 17% drop with the 15-20% upper-limit message", () => {
    // 9 → 7.5 = 16.7% drop
    const result = validateWeightDifferential([throwingBlock("B1", [9, 7.5])]);
    expect(result.valid).toBe(false);
    const warning = result.warnings[0];
    expect(warning.type).toBe("weight_differential");
    expect(warning.severity).toBe("warning");
    expect(warning.message).toMatch(/upper limit of the optimal transfer window/);
    expect(warning.blockIndex).toBe(0);
    expect(warning.exerciseIndex).toBe(1);
  });

  it("flags a >20% drop with the separate-adaptation-zone message", () => {
    // 9 → 6 = 33% drop
    const result = validateWeightDifferential([throwingBlock("B1", [9, 6])]);
    expect(result.valid).toBe(false);
    const warning = result.warnings[0];
    expect(warning.severity).toBe("warning");
    expect(warning.message).toMatch(/exceeds the 20% Vol IV ceiling/);
    expect(warning.message).toMatch(/separate adaptation zones/);
  });

  it("treats 20% exactly as in-window (boundary inclusive)", () => {
    // 10 → 8 = exactly 20% — the rule is "more than 20%"
    const result = validateWeightDifferential([throwingBlock("B1", [10, 8])]);
    // 20% diff is the soft threshold's upper limit; we flag only > 15%.
    // 20% > 15% so it IS flagged, but as upper-limit, not exceeds-20.
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toMatch(/upper limit of the optimal transfer window/);
    expect(result.warnings[0].message).not.toMatch(/exceeds the 20%/);
  });

  it("flags differential across consecutive throwing blocks (heaviest-to-heaviest)", () => {
    // B1 max=9, B2 max=6 → 33% drop
    const result = validateWeightDifferential([
      throwingBlock("B1", [9, 8]),
      strengthBlock("Lifts"),
      throwingBlock("B2", [6]),
    ]);
    // Within-block drops are 11% (9→8) and 0%, no within-block warnings.
    // Across blocks: 9 → 6 = 33% → warning.
    expect(
      result.warnings.some((w) => w.message.includes('"B1"') && w.message.includes('"B2"'))
    ).toBe(true);
  });

  it("ignores non-throwing blocks", () => {
    const result = validateWeightDifferential([strengthBlock("Lifts"), warmupBlock()]);
    expect(result.valid).toBe(true);
  });

  it("ignores exercises without an implement weight", () => {
    const block: BlockInput = {
      name: "B1",
      blockType: "throwing",
      exercises: [
        { name: "9kg throw", implementKg: 9 },
        { name: "stretching", implementKg: null },
        { name: "7.26kg throw", implementKg: 7.26 },
      ],
    };
    // Weighted-only sequence: 9 → 7.26 = 19.3% → upper-limit warning.
    const result = validateWeightDifferential([block]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toMatch(/upper limit/);
  });
});

// ── interaction with descending-order validation ────────────────────────

describe("session-validators: differential × descending interaction", () => {
  it("ascending order produces an error, while differential adds an independent warning", () => {
    // 6 → 9 = ascending (descending-order ERROR) and 33% differential (WARNING)
    const result = validateFullSession([throwingBlock("B1", [6, 9])]);
    const types = result.warnings.map((w) => w.type);
    expect(types).toContain("ascending_weight");
    expect(types).toContain("weight_differential");
    const error = result.warnings.find((w) => w.severity === "error");
    expect(error?.type).toBe("ascending_weight");
  });

  it("clean descending small drop (~10%) emits no warnings", () => {
    const result = validateFullSession([throwingBlock("B1", [8, 7.26])]);
    expect(result.valid).toBe(true);
  });
});

// ── validateFullSession ─────────────────────────────────────────────────

describe("session-validators: validateFullSession", () => {
  it("runs all three validators and aggregates warnings", () => {
    const result = validateFullSession([
      throwingBlock("B1", [6, 8]), // ascending_weight
      throwingBlock("B2", [7.26]), // consecutive_throwing + cross_block_ascending (7.26 > 8 is false, but 8 was intra-block max; heaviest implement in B1 is 8 vs B2 7.26 → NOT triggered)
    ]);
    expect(result.valid).toBe(false);
    const types = result.warnings.map((w) => w.type);
    expect(types).toContain("ascending_weight");
    expect(types).toContain("consecutive_throwing");
  });

  it("returns valid=true for a clean session", () => {
    // B1 max → B2 max stays under 15% (9 → 8 = 11%) so the cross-block
    // differential rule doesn't trip. Within each block the steps are
    // also under 15%.
    const result = validateFullSession([
      throwingBlock("B1", [9, 8, 7.26]),
      strengthBlock("Lifts"),
      throwingBlock("B2", [8]),
      strengthBlock("Core"),
    ]);
    expect(result.valid).toBe(true);
  });
});
