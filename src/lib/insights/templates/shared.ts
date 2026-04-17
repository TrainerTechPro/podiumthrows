// src/lib/insights/templates/shared.ts
import type { ConfidenceBand } from "../types";

export const EVENT_LABEL: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

export const LIFT_LABEL: Record<string, string> = {
  BACK_SQUAT: "Back Squat",
  FRONT_SQUAT: "Front Squat",
  POWER_CLEAN: "Power Clean",
  SNATCH: "Snatch",
  BENCH_PRESS: "Bench Press",
};

export const FACTOR_LABEL: Record<string, string> = {
  sleepQuality: "Sleep quality",
  sleepHours: "Sleep duration",
  soreness: "Soreness",
  stressLevel: "Stress level",
  energyMood: "Energy",
  hrvMs: "HRV",
  restingHR: "Resting heart rate",
  whoopStrain: "Strain",
};

export const CONFIDENCE_LABEL: Record<ConfidenceBand, string> = {
  WEAK: "Weak",
  MEDIUM: "Medium",
  STRONG: "Strong",
};

/**
 * Lower-case exercise label for use in-sentence.
 * The analyzer stores exercise names verbatim (e.g., "8kg Shot"); templates
 * lowercase them to read naturally in prose.
 */
export function formatExerciseLabel(raw: string): string {
  return raw.toLowerCase();
}

/**
 * Given a target delta in meters and a slope in meters-per-kg,
 * returns the number of kg that corresponds to the target delta.
 * Rounded to nearest kg. Returns 0 when slope is 0 to avoid division-by-zero.
 */
export function effectSize(targetDelta: number, slopePerKg: number): number {
  if (slopePerKg === 0) return 0;
  return Math.round(Math.abs(targetDelta / slopePerKg));
}
