import { describe, it, expect } from "vitest";
import { canonicalLift, lbsToKg, estimateOneRM, estimateThreeRM } from "../rep-max";

describe("canonicalLift", () => {
  it("matches back squat variants", () => {
    expect(canonicalLift("Back Squat")).toBe("BACK_SQUAT");
    expect(canonicalLift("back squat")).toBe("BACK_SQUAT");
    expect(canonicalLift("  Back  Squat (pause)  ")).toBe("BACK_SQUAT");
  });

  it("matches front squat variants", () => {
    expect(canonicalLift("Front Squat")).toBe("FRONT_SQUAT");
    expect(canonicalLift("front-squat")).toBe("FRONT_SQUAT");
  });

  it("matches power clean but not hang clean", () => {
    expect(canonicalLift("Power Clean")).toBe("POWER_CLEAN");
    expect(canonicalLift("power clean")).toBe("POWER_CLEAN");
    expect(canonicalLift("Hang Power Clean")).toBeNull();
  });

  it("matches snatch but not hang snatch", () => {
    expect(canonicalLift("Snatch")).toBe("SNATCH");
    expect(canonicalLift("snatch from blocks")).toBe("SNATCH");
    expect(canonicalLift("Hang Snatch")).toBeNull();
  });

  it("matches bench press variants", () => {
    expect(canonicalLift("Bench Press")).toBe("BENCH_PRESS");
    expect(canonicalLift("Bench")).toBe("BENCH_PRESS");
    expect(canonicalLift("bench press (close grip)")).toBe("BENCH_PRESS");
  });

  it("rejects unknown lifts", () => {
    expect(canonicalLift("Deadlift")).toBeNull();
    expect(canonicalLift("Overhead Press")).toBeNull();
    expect(canonicalLift("")).toBeNull();
  });
});

describe("lbsToKg", () => {
  it("converts 225 lbs to ~102.06 kg", () => {
    expect(lbsToKg(225)).toBeCloseTo(102.058, 2);
  });

  it("converts 0 to 0", () => {
    expect(lbsToKg(0)).toBe(0);
  });
});

describe("estimateOneRM (Epley)", () => {
  it("85kg × 5 reps → ~99.17kg 1RM", () => {
    // Epley: 85 × (1 + 5/30) = 85 × 1.1667 = 99.17
    expect(estimateOneRM(85, 5)).toBeCloseTo(99.167, 2);
  });

  it("100kg × 1 rep → 103.33kg (raw Epley applies even at 1 rep)", () => {
    // Raw Epley: 100 * (1 + 1/30) = 103.33. Documenting the formula as-is.
    expect(estimateOneRM(100, 1)).toBeCloseTo(103.333, 2);
  });

  it("ignores reps > 10 (returns 0 to signal unusable set)", () => {
    expect(estimateOneRM(60, 15)).toBe(0);
  });

  it("ignores zero or negative weight", () => {
    expect(estimateOneRM(0, 5)).toBe(0);
    expect(estimateOneRM(-10, 5)).toBe(0);
  });

  it("ignores zero or negative reps", () => {
    expect(estimateOneRM(100, 0)).toBe(0);
    expect(estimateOneRM(100, -1)).toBe(0);
  });
});

describe("estimateThreeRM", () => {
  it("85kg × 5 reps implies 3RM of ~90.15kg", () => {
    // 1RM = 99.17, 3RM = 1RM × 30/33 = 90.15
    expect(estimateThreeRM(85, 5)).toBeCloseTo(90.152, 2);
  });

  it("returns 0 when set is unusable for rep-max estimation", () => {
    expect(estimateThreeRM(60, 15)).toBe(0);
    expect(estimateThreeRM(0, 5)).toBe(0);
  });
});
