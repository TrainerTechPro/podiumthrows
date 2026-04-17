// src/lib/competitions/__tests__/parseDistance.test.ts
import { describe, it, expect } from "vitest";
import { parseDistance, formatDistance } from "../parseDistance";

describe("parseDistance", () => {
  it("parses bare meters", () => {
    expect(parseDistance("18.42")).toEqual({ meters: 18.42, unit: "m", original: 18.42 });
    expect(parseDistance("18.42m")).toEqual({ meters: 18.42, unit: "m", original: 18.42 });
    expect(parseDistance(" 18.42 m ")).toEqual({ meters: 18.42, unit: "m", original: 18.42 });
  });

  it("parses feet + inches with quote notation", () => {
    // 60'4" = 60 ft + 4 in = 720 + 4 = 724 in = 18.389... m
    const r = parseDistance(`60'4"`);
    expect(r?.unit).toBe("ft");
    expect(r?.original).toBe(60.333333333333336); // 60 + 4/12 ft (exact for display)
    expect(r?.meters).toBeCloseTo(18.3896, 3);
  });

  it("parses feet + inches with dash notation", () => {
    const r = parseDistance("60-4");
    expect(r?.unit).toBe("ft");
    expect(r?.meters).toBeCloseTo(18.3896, 3);
  });

  it("parses whole feet with ft suffix", () => {
    const r = parseDistance("60ft");
    expect(r?.unit).toBe("ft");
    expect(r?.original).toBe(60);
    expect(r?.meters).toBeCloseTo(18.288, 3);
  });

  it("rejects garbage", () => {
    expect(parseDistance("")).toBeNull();
    expect(parseDistance("abc")).toBeNull();
    expect(parseDistance("-5")).toBeNull();
    expect(parseDistance("60'15\"")).toBeNull(); // inches >= 12 invalid
    expect(parseDistance(`0'0"`)).toBeNull(); // zero-foot zero-inch is not a valid throw
  });
});

describe("formatDistance", () => {
  it("formats meters", () => {
    expect(formatDistance(18.42, "m")).toBe("18.42m");
  });

  it("preserves two decimal places for whole-meter values", () => {
    expect(formatDistance(18, "m")).toBe("18.00m");
    expect(formatDistance(18.5, "m")).toBe("18.50m");
  });

  it("formats feet as ft'in\"", () => {
    expect(formatDistance(18.3896, "ft")).toBe(`60'4"`);
  });

  it("renders dash for null", () => {
    expect(formatDistance(null, "m")).toBe("—");
  });
});
