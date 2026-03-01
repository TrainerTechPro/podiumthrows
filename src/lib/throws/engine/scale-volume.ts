// ── Volume Scaling Engine ────────────────────────────────────────────
// Scales weekly throw volume based on adaptation profile, experience,
// current weekly volume, and phase parameters.

import { PHASE_CONFIGS } from "../constants";
import type { TrainingPhase } from "../constants";
import type { VolumeTargets, ProgramConfig } from "./types";

// ── Configuration ───────────────────────────────────────────────────

/** Adaptation group scaling multipliers (relative to phase base volume) */
const ADAPTATION_MULTIPLIERS: Record<number, number> = {
  1: 0.85, // Fast adapters: slightly less volume, peak faster
  2: 1.0,  // Moderate: baseline
  3: 1.15, // Slow adapters: more volume to drive adaptation
};

/** Experience-based volume scaling */
function experienceMultiplier(yearsThowing: number): number {
  if (yearsThowing < 1) return 0.65;
  if (yearsThowing < 2) return 0.75;
  if (yearsThowing < 3) return 0.85;
  if (yearsThowing < 5) return 0.95;
  return 1.0; // 5+ years, full volume
}

/**
 * Current volume ramp — if athlete is currently doing far less volume
 * than the target, ramp up gradually to avoid injury.
 */
function volumeRampMultiplier(
  currentWeeklyVolume: number | undefined,
  targetVolume: number,
): number {
  if (!currentWeeklyVolume || currentWeeklyVolume <= 0) return 0.70;
  const ratio = currentWeeklyVolume / targetVolume;
  if (ratio >= 0.85) return 1.0;
  if (ratio >= 0.65) return 0.90;
  if (ratio >= 0.45) return 0.80;
  return 0.70;
}

// ── Main Function ───────────────────────────────────────────────────

/**
 * Calculate scaled volume targets for a training week.
 *
 * Input:
 *   - phase: current training phase
 *   - config: full program config with adaptation, experience, current volume
 *
 * Output:
 *   - throwsPerWeek: total weekly throws target
 *   - throwsPerSession: throws per day type (A, B, C, D, E)
 *   - strengthDaysPerWeek: strength training days
 */
export function scaleVolume(
  phase: TrainingPhase,
  config: ProgramConfig,
): VolumeTargets {
  const phaseConfig = PHASE_CONFIGS.find((p) => p.phase === phase);
  if (!phaseConfig) {
    throw new Error(`Unknown phase: ${phase}`);
  }

  // Base volume: midpoint of phase range
  const baseVolume = Math.round(
    (phaseConfig.throwsPerWeekMin + phaseConfig.throwsPerWeekMax) / 2,
  );

  // Apply scaling multipliers
  const adaptMult = ADAPTATION_MULTIPLIERS[config.adaptationGroup] ?? 1.0;
  const expMult = experienceMultiplier(config.yearsThowing);
  const rampMult = volumeRampMultiplier(config.currentWeeklyVolume, baseVolume);

  // Days-per-week scaling: fewer days = less total volume
  const daysFactor = config.daysPerWeek / 4; // Normalized to 4 days/week baseline

  const scaledVolume = Math.round(
    baseVolume * adaptMult * expMult * rampMult * daysFactor,
  );

  // Clamp to phase bounds (scaled by daysFactor)
  const min = Math.round(phaseConfig.throwsPerWeekMin * daysFactor * 0.8);
  const max = Math.round(phaseConfig.throwsPerWeekMax * daysFactor * 1.1);
  let throwsPerWeek = Math.min(max, Math.max(min, scaledVolume));

  // Absolute safety ceiling — no athlete should exceed 350 throws/week
  const ABSOLUTE_WEEKLY_CEILING = 350;
  throwsPerWeek = Math.min(ABSOLUTE_WEEKLY_CEILING, throwsPerWeek);

  // Beginner guard — athletes with < 1 year experience capped at 200/week
  if (config.yearsThowing < 1 && throwsPerWeek > 200) {
    throwsPerWeek = 200;
  }

  // Distribute across day types using WEEKLY_SCHEDULES proportions
  const throwsPerSession = distributeAcrossDayTypes(throwsPerWeek, phase);

  // Strength days
  const baseStrength = Math.round(
    (phaseConfig.strengthDaysMin + phaseConfig.strengthDaysMax) / 2,
  );
  const strengthDaysPerWeek = config.includeLift
    ? Math.min(baseStrength, config.daysPerWeek)
    : 0;

  return {
    throwsPerWeek,
    throwsPerSession,
    strengthDaysPerWeek,
  };
}

// ── Distribution Helpers ────────────────────────────────────────────

/**
 * Distribute throws across day types (A, B, C, D, E, MEET).
 * Uses approximate proportions based on the phase templates.
 */
function distributeAcrossDayTypes(
  totalThrows: number,
  phase: TrainingPhase,
): Record<string, number> {
  // Proportional weights for each day type
  const DAY_TYPE_WEIGHTS: Record<string, Record<string, number>> = {
    ACCUMULATION: { A: 0.35, B: 0.15, C: 0.0, D: 0.0, E: 0.05 },
    TRANSMUTATION: { A: 0.25, B: 0.12, C: 0.28, D: 0.0, E: 0.05 },
    REALIZATION: { A: 0.0, B: 0.0, C: 0.45, D: 0.15, E: 0.05 },
    COMPETITION: { A: 0.0, B: 0.0, C: 0.45, D: 0.15, E: 0.05, MEET: 0.10 },
  };

  const weights = DAY_TYPE_WEIGHTS[phase] ?? DAY_TYPE_WEIGHTS.ACCUMULATION;
  const result: Record<string, number> = {};

  // Normalize weights to sum to 1
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  for (const [dayType, weight] of Object.entries(weights)) {
    if (weight > 0) {
      result[dayType] = Math.round((totalThrows * weight) / totalWeight);
    }
  }

  return result;
}

// ── Volume Adjustment Functions ─────────────────────────────────────

/**
 * Reduce volume by a percentage (for deload weeks or adaptation).
 */
export function reduceVolume(
  targets: VolumeTargets,
  reductionPercent: number,
): VolumeTargets {
  const factor = 1 - reductionPercent / 100;
  return {
    throwsPerWeek: Math.round(targets.throwsPerWeek * factor),
    throwsPerSession: Object.fromEntries(
      Object.entries(targets.throwsPerSession).map(([k, v]) => [
        k,
        Math.round(v * factor),
      ]),
    ),
    strengthDaysPerWeek: Math.max(
      0,
      Math.round(targets.strengthDaysPerWeek * factor),
    ),
  };
}

/**
 * Increase volume by a percentage (for progressive overload).
 */
export function increaseVolume(
  targets: VolumeTargets,
  increasePercent: number,
): VolumeTargets {
  const factor = 1 + increasePercent / 100;
  return {
    throwsPerWeek: Math.round(targets.throwsPerWeek * factor),
    throwsPerSession: Object.fromEntries(
      Object.entries(targets.throwsPerSession).map(([k, v]) => [
        k,
        Math.round(v * factor),
      ]),
    ),
    strengthDaysPerWeek: targets.strengthDaysPerWeek,
  };
}

/**
 * Calculate deload volume (50% reduction for recovery week).
 */
export function deloadVolume(targets: VolumeTargets): VolumeTargets {
  return reduceVolume(targets, 50);
}
