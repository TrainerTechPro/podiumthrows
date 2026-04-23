import { describe, it, expect } from "vitest";
import { parseNumericInput, parseIntegerInput } from "@/lib/forms/parse-numeric";

describe("parseNumericInput", () => {
  it("returns null for empty string", () => {
    expect(parseNumericInput("")).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseNumericInput(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseNumericInput(undefined)).toBeNull();
  });

  it('preserves 0 from "0"', () => {
    expect(parseNumericInput("0")).toBe(0);
  });

  it('preserves 0 from "0.0"', () => {
    expect(parseNumericInput("0.0")).toBe(0);
  });

  it("returns null for non-numeric text", () => {
    expect(parseNumericInput("abc")).toBeNull();
  });

  it("parses decimal values", () => {
    expect(parseNumericInput("12.5")).toBe(12.5);
  });

  it("parses negative values", () => {
    expect(parseNumericInput("-3")).toBe(-3);
  });

  it('returns null for "NaN" input', () => {
    expect(parseNumericInput("NaN")).toBeNull();
  });

  it("trims leading and trailing whitespace", () => {
    expect(parseNumericInput("  42  ")).toBe(42);
  });

  it("returns null for whitespace-only input", () => {
    expect(parseNumericInput("   ")).toBeNull();
  });
});

describe("parseIntegerInput", () => {
  it("returns null for empty string", () => {
    expect(parseIntegerInput("")).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseIntegerInput(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseIntegerInput(undefined)).toBeNull();
  });

  it('preserves 0 from "0"', () => {
    expect(parseIntegerInput("0")).toBe(0);
  });

  it('truncates "0.0" to 0 (parseInt drops the decimal)', () => {
    expect(parseIntegerInput("0.0")).toBe(0);
  });

  it("returns null for non-numeric text", () => {
    expect(parseIntegerInput("abc")).toBeNull();
  });

  it('truncates "12.5" to 12', () => {
    expect(parseIntegerInput("12.5")).toBe(12);
  });

  it("parses negative values", () => {
    expect(parseIntegerInput("-3")).toBe(-3);
  });

  it('returns null for "NaN" input', () => {
    expect(parseIntegerInput("NaN")).toBeNull();
  });

  it("trims leading and trailing whitespace", () => {
    expect(parseIntegerInput("  42  ")).toBe(42);
  });
});
