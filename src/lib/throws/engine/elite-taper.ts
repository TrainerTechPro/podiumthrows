// ── Gap 4: Elite Taper (Exponential Decay) ────────────────────────────
// Replaces linear COMPETITION phase taper with Mujika & Padilla
// exponential decay model.

import type {
  TaperConfig,
  TaperPlan,
  CompetitionImportance,
  WeekMultiplier,
} from "./types";

// ── Constants ───────────────────────────────────────────────────────

/** Decay constants by adaptation group */
const DECAY_CONSTANTS: Record<number, number> = {
  1: 0.20, // Fast adapters: aggressive taper
  2: 0.15, // Moderate
  3: 0.10, // Slow adapters: gradual taper
};

/** Taper duration in days by adaptation group */
const TAPER_DURATION_DAYS: Record<number, number> = {
  1: 10,
  2: 14,
  3: 21,
};

/** Importance scaling factors */
const IMPORTANCE_SCALE: Record<CompetitionImportance, number> = {
  A_MEET: 1.0,
  B_MEET: 0.70,
  C_MEET: 0.40,
};

/** CE intensity never drops below 90% during taper */
const CE_INTENSITY_FLOOR = 0.90;

// ── Main Function ───────────────────────────────────────────────────

/**
 * Compute an exponential decay taper plan.
 *
 * Model: rawMultiplier = e^(-k × (duration - daysOut))
 *        adjustedMultiplier = 1 - (1 - rawMultiplier) × importanceScale
 *
 * Daily multipliers are averaged into weekly multipliers.
 */
export function computeTaper(config: TaperConfig): TaperPlan {
  const {
    daysUntilMeet,
    adaptationGroup,
    competitionImportance,
    totalTaperWeeks,
  } = config;

  const k = DECAY_CONSTANTS[adaptationGroup] ?? 0.15;
  const taperDuration = Math.min(
    daysUntilMeet,
    TAPER_DURATION_DAYS[adaptationGroup] ?? 14,
  );
  const importanceScale = IMPORTANCE_SCALE[competitionImportance] ?? 1.0;

  // Compute daily multipliers for the entire taper period
  const totalDays = totalTaperWeeks * 7;
  const dailyMultipliers: number[] = [];

  for (let day = 0; day < totalDays; day++) {
    const daysOut = totalDays - day;
    const multiplier = computeTaperDayMultiplier(
      daysOut,
      adaptationGroup,
      competitionImportance,
    );
    dailyMultipliers.push(multiplier);
  }

  // Average daily multipliers into weekly multipliers
  const weekMultipliers: WeekMultiplier[] = [];
  for (let w = 0; w < totalTaperWeeks; w++) {
    const weekStart = w * 7;
    const weekEnd = Math.min(weekStart + 7, totalDays);
    const weekDays = dailyMultipliers.slice(weekStart, weekEnd);
    const avg =
      weekDays.length > 0
        ? weekDays.reduce((a, b) => a + b, 0) / weekDays.length
        : 1.0;

    weekMultipliers.push({
      weekIndex: w,
      volumeMultiplier: Math.round(avg * 100) / 100,
      rationale: `Taper week ${w + 1}/${totalTaperWeeks} (${competitionImportance}, group ${adaptationGroup})`,
    });
  }

  return {
    weekMultipliers,
    dailyMultipliers,
    taperDuration,
    decayConstant: k,
    ceIntensityFloor: CE_INTENSITY_FLOOR,
    rationale:
      `Exponential decay taper: k=${k}, duration=${taperDuration}d, ` +
      `importance=${competitionImportance} (scale=${importanceScale})`,
  };
}

/**
 * Single-day convenience function for taper multiplier.
 *
 * rawMultiplier = e^(-k × (duration - daysOut))
 * adjustedMultiplier = 1 - (1 - rawMultiplier) × importanceScale
 */
export function computeTaperDayMultiplier(
  daysOut: number,
  adaptationGroup: number,
  importance: CompetitionImportance,
): number {
  const k = DECAY_CONSTANTS[adaptationGroup] ?? 0.15;
  const duration = TAPER_DURATION_DAYS[adaptationGroup] ?? 14;
  const importanceScale = IMPORTANCE_SCALE[importance] ?? 1.0;

  if (daysOut > duration) return 1.0; // Before taper starts

  const elapsed = duration - daysOut;
  const rawMultiplier = Math.exp(-k * elapsed);
  const adjustedMultiplier = 1 - (1 - rawMultiplier) * importanceScale;

  // Clamp to reasonable range [0.10, 1.0]
  return Math.max(0.10, Math.min(1.0, adjustedMultiplier));
}
