import { describe, it, expect } from "vitest";
import {
  validateImplementSequence,
  validateBlockStructure,
  validateCrossBlockSequence,
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
    const result = validateBlockStructure([
      throwingBlock("B1", [8]),
      throwingBlock("B2", [7.26]),
    ]);
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
    const result = validateFullSession([
      throwingBlock("B1", [9, 8, 7.26]),
      strengthBlock("Lifts"),
      throwingBlock("B2", [6]),
      strengthBlock("Core"),
    ]);
    expect(result.valid).toBe(true);
  });
});
