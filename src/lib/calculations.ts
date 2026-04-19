/**
 * Bondarchuk methodology calculations and throws-specific utilities.
 *
 * For COMPETITION_WEIGHTS and implement-sequence validators, see:
 *   @/lib/throws/constants   — single source for competition weights
 *   @/lib/bondarchuk          — implement-sequence validators
 */

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
