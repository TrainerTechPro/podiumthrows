/**
 * Bondarchuk methodology calculations and throws-specific utilities.
 */

/** Competition implement weights in kg by event and gender */
export const COMPETITION_WEIGHTS = {
  SHOT_PUT: { MALE: 7.26, FEMALE: 4.0 },
  DISCUS: { MALE: 2.0, FEMALE: 1.0 },
  HAMMER: { MALE: 7.26, FEMALE: 4.0 },
  JAVELIN: { MALE: 0.8, FEMALE: 0.6 },
} as const;

/**
 * Validate implement weight sequencing (Bondarchuk methodology).
 * DESCENDING weight order is the ONLY correct sequence.
 * Returns true if sequence is valid (descending or single implement).
 */
export function validateImplementSequence(weights: number[]): {
  valid: boolean;
  message: string;
} {
  if (weights.length <= 1) {
    return { valid: true, message: "Single implement — valid." };
  }

  for (let i = 1; i < weights.length; i++) {
    if (weights[i] > weights[i - 1]) {
      return {
        valid: false,
        message: `INVALID: Ascending sequence detected (${weights[i - 1]}kg → ${weights[i]}kg). Bondarchuk methodology requires descending weight order. Ascending sequences cause 2-4m performance decrease in natural athletes.`,
      };
    }
  }

  return { valid: true, message: "Descending sequence — valid." };
}

/**
 * Check if an implement weight is within the 15-20% differential range
 * of competition weight. Weights outside this range create separate
 * adaptations rather than transfer.
 */
export function checkWeightDifferential(
  implementWeight: number,
  competitionWeight: number
): {
  withinRange: boolean;
  differentialPercent: number;
  message: string;
} {
  const diff = Math.abs(implementWeight - competitionWeight);
  const percent = (diff / competitionWeight) * 100;

  return {
    withinRange: percent <= 20,
    differentialPercent: Math.round(percent * 10) / 10,
    message:
      percent <= 20
        ? `${percent.toFixed(1)}% differential — within transfer range.`
        : `${percent.toFixed(1)}% differential — WARNING: exceeds 20% threshold. This implement may create separate adaptations, not transfer.`,
  };
}

/**
 * Calculate RPE-based load recommendation.
 * RPE 1-10 scale (Borg CR-10).
 */
export function rpeToIntensityPercent(rpe: number): number {
  const mapping: Record<number, number> = {
    1: 50, 2: 55, 3: 60, 4: 65, 5: 70,
    6: 75, 7: 80, 8: 85, 9: 90, 10: 100,
  };
  return mapping[Math.round(Math.min(10, Math.max(1, rpe)))] ?? 70;
}
