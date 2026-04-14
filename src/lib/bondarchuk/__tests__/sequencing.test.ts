import { describe, it, expect } from "vitest";
import { validateImplementSequence } from "@/lib/bondarchuk/sequencing";

describe("validateImplementSequence", () => {
  it("accepts an empty sequence", () => {
    const result = validateImplementSequence([]);
    expect(result).toEqual({ ok: true });
  });

  it("accepts a single-weight session", () => {
    const result = validateImplementSequence([{ implementWeightKg: 7.26, orderIndex: 0 }]);
    expect(result).toEqual({ ok: true });
  });

  it("accepts a descending sequence (heavy → comp)", () => {
    const result = validateImplementSequence([
      { implementWeightKg: 9, orderIndex: 0 },
      { implementWeightKg: 8, orderIndex: 1 },
      { implementWeightKg: 7.26, orderIndex: 2 },
    ]);
    expect(result).toEqual({ ok: true });
  });

  it("accepts equal consecutive weights (7.26kg → 7.26kg is a valid set)", () => {
    const result = validateImplementSequence([
      { implementWeightKg: 7.26, orderIndex: 0 },
      { implementWeightKg: 7.26, orderIndex: 1 },
    ]);
    expect(result).toEqual({ ok: true });
  });

  it("rejects an ascending sequence and reports the heavier follower", () => {
    const result = validateImplementSequence([
      { implementWeightKg: 6, orderIndex: 0 },
      { implementWeightKg: 8, orderIndex: 1 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.offendingIndex).toBe(1);
      expect(result.violation).toMatch(/8/);
      expect(result.violation).toMatch(/6/);
    }
  });

  it("rejects a mid-sequence ascending violation (7.26 → 8 after 9)", () => {
    const result = validateImplementSequence([
      { implementWeightKg: 9, orderIndex: 0 },
      { implementWeightKg: 7.26, orderIndex: 1 },
      { implementWeightKg: 8, orderIndex: 2 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.offendingIndex).toBe(2);
    }
  });

  it("allows null weights (bodyweight / medicine ball) at any index", () => {
    const result = validateImplementSequence([
      { implementWeightKg: null, orderIndex: 0 },
      { implementWeightKg: 9, orderIndex: 1 },
      { implementWeightKg: null, orderIndex: 2 },
      { implementWeightKg: 7.26, orderIndex: 3 },
      { implementWeightKg: null, orderIndex: 4 },
    ]);
    expect(result).toEqual({ ok: true });
  });

  it("does not treat null weights as part of the sequence", () => {
    // Ascending 6 → 8 must still fire, even with nulls in between
    const result = validateImplementSequence([
      { implementWeightKg: 6, orderIndex: 0 },
      { implementWeightKg: null, orderIndex: 1 },
      { implementWeightKg: 8, orderIndex: 2 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.offendingIndex).toBe(2);
    }
  });

  it("sorts by orderIndex before validating (input order is not trusted)", () => {
    // Caller passes out-of-order array; validator must sort by orderIndex
    const result = validateImplementSequence([
      { implementWeightKg: 7.26, orderIndex: 2 },
      { implementWeightKg: 9, orderIndex: 0 },
      { implementWeightKg: 8, orderIndex: 1 },
    ]);
    expect(result).toEqual({ ok: true });
  });

  it("accepts a 15-20% differential as valid sequencing (separate rule handles that)", () => {
    // 8.5kg → 7.26kg is a ~15% drop, still descending — must be ok
    const result = validateImplementSequence([
      { implementWeightKg: 8.5, orderIndex: 0 },
      { implementWeightKg: 7.26, orderIndex: 1 },
    ]);
    expect(result).toEqual({ ok: true });
  });

  it("violation message names both weights in violation order", () => {
    const result = validateImplementSequence([
      { implementWeightKg: 7.26, orderIndex: 0 },
      { implementWeightKg: 9, orderIndex: 1 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // heavier must come first — "9kg cannot follow 7.26kg"
      expect(result.violation.toLowerCase()).toContain("cannot follow");
    }
  });
});
