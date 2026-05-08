import { describe, it, expect } from "vitest";
import {
  getRequiredCapabilities,
  getDisabledCapabilities,
  getExerciseViolations,
  type MovementCapability,
} from "@/lib/bondarchuk/movement-restrictions";

/**
 * Phase C.3 — pure helper that maps exercise names to the movement
 * capabilities they require, then checks against an athlete's
 * MovementRestrictionsData. Used by future UI consumers to badge or
 * filter exercises that violate an athlete's known restrictions.
 *
 * The keyword set targets common throws-strength exercises. Names that
 * include a restricted movement keyword are flagged. Conservative bias:
 * when in doubt, flag — coach reviews. False positives are cheaper than
 * false negatives in this domain.
 */
describe("getRequiredCapabilities", () => {
  it("returns empty for exercises with no movement keywords", () => {
    expect(getRequiredCapabilities("Bicep Curl")).toEqual([]);
    expect(getRequiredCapabilities("Calf Raise")).toEqual([]);
    expect(getRequiredCapabilities("")).toEqual([]);
  });

  it("flags fullOverhead for overhead-pattern exercises", () => {
    expect(getRequiredCapabilities("Overhead Press")).toContain("fullOverhead");
    expect(getRequiredCapabilities("Push Press")).toContain("fullOverhead");
    expect(getRequiredCapabilities("Push Jerk")).toContain("fullOverhead");
    expect(getRequiredCapabilities("Pullover")).toContain("fullOverhead");
  });

  it("flags fullHipRotation for rotational exercises", () => {
    expect(getRequiredCapabilities("Russian Twist")).toContain("fullHipRotation");
    expect(getRequiredCapabilities("Cable Wood Chop")).toContain("fullHipRotation");
    expect(getRequiredCapabilities("Rotational Med Ball Throw")).toContain("fullHipRotation");
  });

  it("flags deepSquat for squat-pattern exercises", () => {
    expect(getRequiredCapabilities("Back Squat")).toContain("deepSquat");
    expect(getRequiredCapabilities("Front Squat")).toContain("deepSquat");
    expect(getRequiredCapabilities("Overhead Squat")).toContain("deepSquat");
    expect(getRequiredCapabilities("Goblet Squat")).toContain("deepSquat");
    expect(getRequiredCapabilities("Box Squat")).toContain("deepSquat");
  });

  it("flags singleLegStability for unilateral lower-body exercises", () => {
    expect(getRequiredCapabilities("Bulgarian Split Squat")).toContain("singleLegStability");
    expect(getRequiredCapabilities("Walking Lunge")).toContain("singleLegStability");
    expect(getRequiredCapabilities("Single Leg RDL")).toContain("singleLegStability");
    expect(getRequiredCapabilities("Pistol Squat")).toContain("singleLegStability");
    expect(getRequiredCapabilities("Step Up")).toContain("singleLegStability");
  });

  it("returns multiple capabilities for compound olympic lifts", () => {
    // Power snatch requires both overhead reception and a deep catch
    const snatch = getRequiredCapabilities("Power Snatch");
    expect(snatch).toContain("fullOverhead");
    expect(snatch).toContain("deepSquat");

    // Clean & jerk requires deep squat (clean catch) and overhead (jerk)
    const cnj = getRequiredCapabilities("Clean and Jerk");
    expect(cnj).toContain("deepSquat");
    expect(cnj).toContain("fullOverhead");

    // Thruster: front squat + overhead press
    const thruster = getRequiredCapabilities("Thruster");
    expect(thruster).toContain("deepSquat");
    expect(thruster).toContain("fullOverhead");
  });

  it("flags Bulgarian split squat for both single-leg and deep-squat", () => {
    const bss = getRequiredCapabilities("Bulgarian Split Squat");
    expect(bss).toContain("singleLegStability");
    expect(bss).toContain("deepSquat");
  });

  it("does not flag bilateral RDL as single-leg", () => {
    expect(getRequiredCapabilities("Romanian Deadlift")).not.toContain("singleLegStability");
    expect(getRequiredCapabilities("RDL")).not.toContain("singleLegStability");
  });

  it("is case-insensitive", () => {
    expect(getRequiredCapabilities("BACK SQUAT")).toContain("deepSquat");
    expect(getRequiredCapabilities("back squat")).toContain("deepSquat");
    expect(getRequiredCapabilities("Back Squat")).toContain("deepSquat");
  });

  it("returns each capability at most once", () => {
    // "Overhead Squat Snatch" hits multiple overhead/squat keywords; each
    // capability should appear once.
    const result = getRequiredCapabilities("Overhead Squat Snatch");
    const overheadCount = result.filter((c) => c === "fullOverhead").length;
    const squatCount = result.filter((c) => c === "deepSquat").length;
    expect(overheadCount).toBeLessThanOrEqual(1);
    expect(squatCount).toBeLessThanOrEqual(1);
  });
});

describe("getDisabledCapabilities", () => {
  it("returns [] for null restrictions", () => {
    expect(getDisabledCapabilities(null)).toEqual([]);
  });

  it("returns [] when all capabilities are true (no restrictions)", () => {
    expect(
      getDisabledCapabilities({
        fullOverhead: true,
        fullHipRotation: true,
        deepSquat: true,
        singleLegStability: true,
        notes: "",
      })
    ).toEqual([]);
  });

  it("returns flags that are false", () => {
    const result = getDisabledCapabilities({
      fullOverhead: false,
      fullHipRotation: true,
      deepSquat: false,
      singleLegStability: true,
      notes: "",
    });
    expect(result).toContain("fullOverhead");
    expect(result).toContain("deepSquat");
    expect(result).not.toContain("fullHipRotation");
    expect(result).not.toContain("singleLegStability");
  });

  it("returns all four when athlete has every restriction", () => {
    const result = getDisabledCapabilities({
      fullOverhead: false,
      fullHipRotation: false,
      deepSquat: false,
      singleLegStability: false,
      notes: "",
    });
    expect(result.sort()).toEqual([
      "deepSquat",
      "fullHipRotation",
      "fullOverhead",
      "singleLegStability",
    ] as MovementCapability[]);
  });
});

describe("getExerciseViolations", () => {
  const noRestrictions = {
    fullOverhead: true,
    fullHipRotation: true,
    deepSquat: true,
    singleLegStability: true,
    notes: "",
  };

  it("returns [] when athlete has no restrictions", () => {
    expect(getExerciseViolations("Back Squat", noRestrictions)).toEqual([]);
    expect(getExerciseViolations("Power Snatch", noRestrictions)).toEqual([]);
  });

  it("returns [] when restrictions is null (unknown — assume safe)", () => {
    expect(getExerciseViolations("Back Squat", null)).toEqual([]);
  });

  it("returns [] for non-restricted exercises even when athlete has restrictions", () => {
    expect(
      getExerciseViolations("Bicep Curl", {
        fullOverhead: false,
        fullHipRotation: false,
        deepSquat: false,
        singleLegStability: false,
        notes: "",
      })
    ).toEqual([]);
  });

  it("returns the violated capability when exercise requires a restricted movement", () => {
    const result = getExerciseViolations("Back Squat", {
      ...noRestrictions,
      deepSquat: false,
    });
    expect(result).toEqual(["deepSquat"]);
  });

  it("returns multiple violated capabilities for compound lifts", () => {
    // Power snatch needs overhead + deep squat. Athlete restricted on both.
    const result = getExerciseViolations("Power Snatch", {
      fullOverhead: false,
      fullHipRotation: true,
      deepSquat: false,
      singleLegStability: true,
      notes: "",
    });
    expect(result.sort()).toEqual(["deepSquat", "fullOverhead"]);
  });

  it("returns only the actually-violated capability when restriction is partial", () => {
    // Snatch needs overhead + deep. Athlete only restricted on deep.
    // Should report deepSquat only — overhead is fine.
    const result = getExerciseViolations("Power Snatch", {
      fullOverhead: true,
      fullHipRotation: true,
      deepSquat: false,
      singleLegStability: true,
      notes: "",
    });
    expect(result).toEqual(["deepSquat"]);
  });
});
