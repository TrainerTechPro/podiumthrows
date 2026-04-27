import { describe, expect, test } from "vitest";
import { _testing } from "../PlateCalculator";

const { rackPlates, plateBreakdown, KG_PLATES, LB_PLATES, BAR_KG, BAR_LB } = _testing;

describe("rackPlates (kg, descending sequence)", () => {
  test("60kg → 20kg per side", () => {
    const perSide = (60 - BAR_KG) / 2; // 20
    const racked = rackPlates(perSide, KG_PLATES);
    const sumWeights = racked.reduce((s, p) => s + p.weight, 0);
    expect(sumWeights).toBeCloseTo(perSide);
    expect(racked.map((r) => r.weight)).toEqual([20]);
  });

  test("100kg → 25 + 10 + 5 per side", () => {
    const perSide = (100 - BAR_KG) / 2; // 40
    const racked = rackPlates(perSide, KG_PLATES);
    const sumWeights = racked.reduce((s, p) => s + p.weight, 0);
    expect(sumWeights).toBeCloseTo(perSide);
    expect(racked.map((r) => r.weight)).toEqual([25, 15]);
  });

  test("160kg → 25 + 25 + 15 + 5 per side", () => {
    const perSide = (160 - BAR_KG) / 2; // 70
    const racked = rackPlates(perSide, KG_PLATES);
    expect(racked.map((r) => r.weight)).toEqual([25, 25, 20]);
    expect(racked.reduce((s, p) => s + p.weight, 0)).toBeCloseTo(perSide);
  });

  test("bar-only weight returns empty stack", () => {
    expect(rackPlates(0, KG_PLATES)).toEqual([]);
  });

  test("each racked plate has a unique key", () => {
    const racked = rackPlates(70, KG_PLATES);
    const keys = new Set(racked.map((r) => r.key));
    expect(keys.size).toBe(racked.length);
  });

  test("handles fractional remainders without infinite loops", () => {
    const racked = rackPlates(2.5, KG_PLATES);
    expect(racked.map((r) => r.weight)).toEqual([2.5]);
  });

  test("220kg+ doesn't break — strongman territory", () => {
    const perSide = (250 - BAR_KG) / 2; // 115
    const racked = rackPlates(perSide, KG_PLATES);
    const sum = racked.reduce((s, p) => s + p.weight, 0);
    expect(sum).toBeCloseTo(perSide);
    // Should be heavy plates first.
    expect(racked[0].weight).toBe(25);
  });
});

describe("rackPlates (lb)", () => {
  test("225lb → 45 + 45 per side", () => {
    const perSide = (225 - BAR_LB) / 2; // 90
    const racked = rackPlates(perSide, LB_PLATES);
    expect(racked.map((r) => r.weight)).toEqual([45, 45]);
  });

  test("315lb → 45 + 45 + 45 per side", () => {
    const perSide = (315 - BAR_LB) / 2; // 135
    const racked = rackPlates(perSide, LB_PLATES);
    expect(racked.map((r) => r.weight)).toEqual([45, 45, 45]);
  });
});

describe("plateBreakdown", () => {
  test("groups same-weight plates with × multiplier", () => {
    const racked = rackPlates(45, KG_PLATES);
    expect(plateBreakdown(racked)).toBe("25 + 20");
  });

  test("uses ×N format when count > 1", () => {
    const stack = [
      { weight: 20, key: "20-0" },
      { weight: 20, key: "20-1" },
      { weight: 5, key: "5-0" },
    ];
    expect(plateBreakdown(stack)).toBe("2×20 + 5");
  });

  test("'Bar only' for empty stacks", () => {
    expect(plateBreakdown([])).toBe("Bar only");
  });
});
