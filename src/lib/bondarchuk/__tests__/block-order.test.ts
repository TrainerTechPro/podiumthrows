import { describe, it, expect } from "vitest";
import { validateBlockOrder } from "@/lib/bondarchuk/block-order";

describe("validateBlockOrder", () => {
  it("accepts an empty session", () => {
    expect(validateBlockOrder([])).toEqual({ ok: true });
  });

  it("accepts a single throwing block", () => {
    expect(validateBlockOrder([{ type: "THROWING", order: 0 }])).toEqual({ ok: true });
  });

  it("accepts the canonical Bondarchuk 4-block structure", () => {
    const result = validateBlockOrder([
      { type: "THROWING", order: 0 },
      { type: "STRENGTH", order: 1 },
      { type: "THROWING", order: 2 },
      { type: "STRENGTH", order: 3 },
    ]);
    expect(result).toEqual({ ok: true });
  });

  it("rejects two consecutive THROWING blocks at the start", () => {
    const result = validateBlockOrder([
      { type: "THROWING", order: 0 },
      { type: "THROWING", order: 1 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.offendingIndex).toBe(1);
      expect(result.violation.toLowerCase()).toContain("throwing");
      expect(result.violation.toLowerCase()).toContain("consecutive");
    }
  });

  it("rejects consecutive THROWING blocks in the middle of a session", () => {
    const result = validateBlockOrder([
      { type: "WARMUP", order: 0 },
      { type: "THROWING", order: 1 },
      { type: "STRENGTH", order: 2 },
      { type: "THROWING", order: 3 },
      { type: "THROWING", order: 4 },
      { type: "COOLDOWN", order: 5 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.offendingIndex).toBe(4);
    }
  });

  it("accepts consecutive non-throwing blocks of the same type", () => {
    const result = validateBlockOrder([
      { type: "STRENGTH", order: 0 },
      { type: "STRENGTH", order: 1 },
    ]);
    expect(result).toEqual({ ok: true });
  });

  it("accepts consecutive MOBILITY → STRENGTH blocks", () => {
    const result = validateBlockOrder([
      { type: "MOBILITY", order: 0 },
      { type: "STRENGTH", order: 1 },
    ]);
    expect(result).toEqual({ ok: true });
  });

  it("allows WARMUP and COOLDOWN freely around throws", () => {
    const result = validateBlockOrder([
      { type: "WARMUP", order: 0 },
      { type: "THROWING", order: 1 },
      { type: "STRENGTH", order: 2 },
      { type: "THROWING", order: 3 },
      { type: "COOLDOWN", order: 4 },
    ]);
    expect(result).toEqual({ ok: true });
  });

  it("treats WARMUP between two THROWING blocks as a valid separator", () => {
    // Interpretation: only STRENGTH is the intended separator per Bondarchuk
    // doctrine. WARMUP between throws is unusual but the ordering rule only
    // bans ADJACENT throws — any non-throwing block counts as a separator.
    const result = validateBlockOrder([
      { type: "THROWING", order: 0 },
      { type: "WARMUP", order: 1 },
      { type: "THROWING", order: 2 },
    ]);
    expect(result).toEqual({ ok: true });
  });

  it("sorts by order before validating (input order is not trusted)", () => {
    const result = validateBlockOrder([
      { type: "THROWING", order: 2 },
      { type: "THROWING", order: 0 },
      { type: "STRENGTH", order: 1 },
    ]);
    expect(result).toEqual({ ok: true });
  });

  it("names both types in the violation message", () => {
    const result = validateBlockOrder([
      { type: "THROWING", order: 0 },
      { type: "THROWING", order: 1 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // should reference that the issue is two THROWING blocks in a row
      const lower = result.violation.toLowerCase();
      expect(lower).toContain("throwing");
      expect(lower).toMatch(/consecutive|adjacent|follow|cannot/);
    }
  });

  it("reports the FIRST violation when multiple exist", () => {
    const result = validateBlockOrder([
      { type: "THROWING", order: 0 },
      { type: "THROWING", order: 1 }, // first violation at index 1
      { type: "THROWING", order: 2 }, // second violation at index 2
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.offendingIndex).toBe(1);
    }
  });
});
