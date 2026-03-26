// ── Volume Scaling Engine ────────────────────────────────────────────
// Derives weekly throw volume from sessions × throws-per-session.
//
// Bondarchuk principle: volume is CONSTANT within each training period.
// The only variable that changes between periods is the exercise complex.
// Phase affects the CE/SD/SP *ratio* of throws, not the total count.

import { PHASE_CONFIGS, THROWS_PER_SESSION } from "../constants";
import type { TrainingPhase } from "../constants";
import type { VolumeTargets, ProgramConfig } from "./types";

// ── Configuration ───────────────────────────────────────────────────

/** Adaptation group scaling multipliers */
const ADAPTATION_MULTIPLIERS: Record<number, number> = {
  1: 0.85, // Fast adapters: slightly less volume, peak faster
  2: 1.0,  // Moderate: baseline
  3: 1.15, // Slow adapters: more volume to drive adaptation
};

/** Experience-based volume scaling.
 * Only meaningfully reduces volume for genuinely new athletes.
 * 3+ years = full volume — these athletes can handle session targets. */
function experienceMultiplier(yearsThrowing: number): number {
  if (yearsThrowing < 1) return 0.70;
  if (yearsThrowing < 2) return 0.80;
  if (yearsThrowing < 3) return 0.90;
  return 1.0; // 3+ years, full volume
}

// ── Main Function ───────────────────────────────────────────────────

/**
 * Calculate scaled volume targets for a training week.
 *
 * Bondarchuk session-derived volume:
 *   sessionsPerWeek = daysPerWeek × sessionsPerDay
 *   baseVolume = sessionsPerWeek × THROWS_PER_SESSION (20)
 *   scaledVolume = baseVolume × adaptationMultiplier × experienceMultiplier
 *
 * Volume is the SAME across all phases. Phase only controls:
 *   - CE/SD/SP ratio (via PHASE_RATIOS)
 *   - Implement distribution (via PHASE_IMPLEMENT_DIST)
 */
export function scaleVolume(
  phase: TrainingPhase,
  config: ProgramConfig,
): VolumeTargets {
  const phaseConfig = PHASE_CONFIGS.find((p) => p.phase === phase);
  if (!phaseConfig) {
    throw new Error(`Unknown phase: ${phase}`);
  }

  // Session-derived base volume (Bondarchuk principle)
  const sessionsPerWeek = config.daysPerWeek * (config.sessionsPerDay ?? 1);
  const baseVolume = sessionsPerWeek * THROWS_PER_SESSION;

  // Apply scaling multipliers (adaptation + experience only)
  const adaptMult = ADAPTATION_MULTIPLIERS[config.adaptationGroup] ?? 1.0;
  const expMult = experienceMultiplier(config.yearsThrowing);

  const scaledVolume = Math.round(baseVolume * adaptMult * expMult);

  // Clamp to phase safety bounds
  const min = phaseConfig.throwsPerWeekMin;
  const max = phaseConfig.throwsPerWeekMax;
  let throwsPerWeek = Math.min(max, Math.max(min, scaledVolume));

  // Absolute safety ceiling — no athlete should exceed 350 throws/week
  const ABSOLUTE_WEEKLY_CEILING = 350;
  throwsPerWeek = Math.min(ABSOLUTE_WEEKLY_CEILING, throwsPerWeek);

  // Beginner guard — athletes with < 1 year experience capped at 200/week
  if (config.yearsThrowing < 1 && throwsPerWeek > 200) {
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
    CLEANSE: { E: 1.0 },
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
