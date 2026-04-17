/**
 * Rep-max helpers for lift↔throw analyzer.
 *
 * Epley formula: 1RM = weight × (1 + reps/30), valid for sets at reps ≤ 10.
 * Higher-rep sets aren't reliable for max estimation and are skipped (return 0).
 */

export const LBS_PER_KG = 2.20462;

export type CanonicalLift = "BACK_SQUAT" | "FRONT_SQUAT" | "POWER_CLEAN" | "SNATCH" | "BENCH_PRESS";

export function lbsToKg(lbs: number): number {
  return lbs / LBS_PER_KG;
}

/**
 * Match a free-text exerciseName to one of the 5 tracked lifts.
 * Returns null for unknown lifts or variants we explicitly exclude (hang cleans,
 * hang snatches — different force-production profile per Bondarchuk conventions).
 */
export function canonicalLift(exerciseName: string): CanonicalLift | null {
  const n = exerciseName.toLowerCase().trim().replace(/\s+/g, " ");
  if (n.length === 0) return null;

  // Exclude hang variants first — they'd otherwise match the base lift below
  if (/\bhang\b/.test(n)) return null;

  if (/\bback[\s-]?squat\b/.test(n)) return "BACK_SQUAT";
  if (/\bfront[\s-]?squat\b/.test(n)) return "FRONT_SQUAT";
  if (/\bpower[\s-]?clean\b/.test(n)) return "POWER_CLEAN";
  if (/\bsnatch\b/.test(n)) return "SNATCH";
  if (/\bbench(?:[\s-]?press)?\b/.test(n)) return "BENCH_PRESS";

  return null;
}

/**
 * Estimate 1RM via Epley for a single set. Returns 0 for unusable sets
 * (reps > 10, non-positive weight, non-positive reps).
 */
export function estimateOneRM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0 || reps > 10) return 0;
  return weightKg * (1 + reps / 30);
}

/**
 * Estimate 3RM via Epley: derived from 1RM scaled to 3 reps.
 * 3RM = 1RM × 30/33.
 */
export function estimateThreeRM(weightKg: number, reps: number): number {
  const oneRM = estimateOneRM(weightKg, reps);
  if (oneRM === 0) return 0;
  return oneRM * (30 / 33);
}
