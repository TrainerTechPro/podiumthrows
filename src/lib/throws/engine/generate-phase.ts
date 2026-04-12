// ── Phase Generator ─────────────────────────────────────────────────
// Builds a complete training phase (mesocycle) with exercise complex
// selection, volume targets, and week-by-week sessions.

import { PHASE_CONFIGS, PHASE_IMPLEMENT_DIST } from "../constants";
import type { TrainingPhase } from "../constants";
import { selectExercises } from "./select-exercises";
import { rotateComplex } from "./complex-manager";
import { scaleVolume } from "./scale-volume";
import { generateWeek } from "./generate-week";
import { computeAdaptiveWave } from "./adaptive-waves";
import { computeTaper } from "./elite-taper";
import type {
  GeneratedPhase,
  PhaseGenConfig,
  ExerciseComplexEntry,
} from "./types";

// ── Complex Rotation ────────────────────────────────────────────────

/**
 * Intra-phase rotation interval in weeks by adaptation group.
 * Bondarchuk methodology: rotate exercises every 8-12 sessions.
 *   Group 1 (fast): 2 weeks (~8 sessions at 4/wk)
 *   Group 2 (moderate): 3 weeks (~12 sessions)
 *   Group 3 (slow): 3 weeks (~12 sessions)
 */
const ROTATION_INTERVAL_WEEKS: Record<number, number> = {
  1: 2,
  2: 3,
  3: 3,
};

// ── Main Function ───────────────────────────────────────────────────

/**
 * Generate a complete training phase (mesocycle).
 *
 * 1. Selects the exercise complex using correlations + deficit bias
 * 2. Calculates scaled volume targets
 * 3. Generates each week within the phase, rotating complex at intervals
 * 4. Applies progressive overload within the phase
 */
export function generatePhase(config: PhaseGenConfig): GeneratedPhase {
  const { phase, phaseOrder, startWeek, durationWeeks, programConfig } = config;

  // Get phase configuration
  const phaseConfig = PHASE_CONFIGS.find((p) => p.phase === phase);
  if (!phaseConfig) {
    throw new Error(`Unknown phase: ${phase}`);
  }

  // Get implement distribution for this phase
  const implDist = PHASE_IMPLEMENT_DIST.find((d) => d.phase === phase);

  // ── Select initial exercise complex ──────────────────────────
  const selectionParams = {
    eventCode: programConfig.eventCode,
    genderCode: programConfig.genderCode,
    distanceBand: programConfig.distanceBand,
    availableImplements: programConfig.availableImplements,
    deficitPrimary: programConfig.deficitPrimary,
    deficitSecondary: programConfig.deficitSecondary,
    transferType: programConfig.transferType,
    personalCorrelations: programConfig.personalCorrelations,
  };

  let exerciseComplex = selectExercises(selectionParams, phase);

  // ── Calculate volume targets ─────────────────────────────────
  const volumeTargets = scaleVolume(phase, programConfig);

  // ── Intra-phase rotation setup ───────────────────────────────
  const rotationInterval = ROTATION_INTERVAL_WEEKS[programConfig.adaptationGroup] ?? 3;
  let rotationIndex = 0;
  const allPreviousComplexes: ExerciseComplexEntry[][] = [];
  const complexHistory: ExerciseComplexEntry[][] = [exerciseComplex];

  // ── Generate weeks ───────────────────────────────────────────
  const weeks = [];

  for (let w = 0; w < durationWeeks; w++) {
    const weekNumber = startWeek + w;

    // Rotate exercise complex at interval boundaries
    if (w > 0 && w % rotationInterval === 0) {
      allPreviousComplexes.push(exerciseComplex);
      exerciseComplex = rotateComplex({
        programConfig,
        currentComplex: exerciseComplex,
        allPreviousComplexes,
        phase,
      });
      rotationIndex++;
      complexHistory.push(exerciseComplex);
    }

    // Progressive overload: taper → adaptive wave → fixed ramp fallback chain
    let progressFactor: number;

    if (phase === "COMPETITION" && config.taperConfig) {
      // Gap 4: Exponential decay taper
      const taperPlan = computeTaper(config.taperConfig);
      progressFactor = taperPlan.weekMultipliers[w]?.volumeMultiplier
        ?? getProgressFactor(w, durationWeeks, phase);
    } else {
      // Gap 3: Adaptive waves (data-driven) or fixed ramp fallback
      const adaptiveWave = config.trainingHistory
        ? computeAdaptiveWave(config.trainingHistory, phase, durationWeeks)
        : null;
      progressFactor = adaptiveWave?.[w]?.volumeMultiplier
        ?? getProgressFactor(w, durationWeeks, phase);
    }

    const weeklyThrowsTarget = Math.round(
      volumeTargets.throwsPerWeek * progressFactor,
    );

    const week = generateWeek({
      weekNumber,
      phase,
      daysPerWeek: programConfig.daysPerWeek,
      sessionsPerDay: programConfig.sessionsPerDay,
      includeLift: programConfig.includeLift,
      throwsPerWeekTarget: weeklyThrowsTarget,
      strengthDaysTarget: volumeTargets.strengthDaysPerWeek,
      exerciseComplex,
      programConfig,
      rotationIndex,
    });

    weeks.push(week);
  }

  return {
    phase,
    phaseOrder,
    startWeek,
    endWeek: startWeek + durationWeeks - 1,
    durationWeeks,

    // Targets
    throwsPerWeekTarget: volumeTargets.throwsPerWeek,
    strengthDaysTarget: volumeTargets.strengthDaysPerWeek,

    // Ratios from phase config
    cePercent: phaseConfig.cePercent,
    sdPercent: phaseConfig.sdPercent,
    spPercent: phaseConfig.spPercent,
    gpPercent: phaseConfig.gpPercent,

    // Implement distribution
    lightPercent: implDist?.lightPercent ?? 25,
    compPercent: implDist?.compPercent ?? 40,
    heavyPercent: implDist?.heavyPercent ?? 35,

    // Exercise complex (last rotation for backward compat)
    exerciseComplex,

    // Full rotation history
    exerciseComplexHistory: complexHistory.length > 1 ? complexHistory : undefined,

    // Generated weeks
    weeks,
  };
}

// ── Volume Multiplier ───────────────────────────────────────────────

/**
 * Returns a volume multiplier for each week within a phase.
 *
 * Bondarchuk principle: volume is CONSTANT within each training period.
 * No progressive overload ramps, no deload weeks. The natural week-4
 * performance dip is an expected part of the adaptation curve.
 *
 * Exception (hybrid concession): REALIZATION and COMPETITION phases
 * apply a mild taper because coaches expect reduced volume approaching
 * a meet. Pure Bondarchuk doesn't taper, but our target users (NCAA
 * coaches) need this for competition peaking.
 */
function getProgressFactor(
  weekIndex: number,
  totalWeeks: number,
  phase: TrainingPhase,
): number {
  const progress = totalWeeks > 1 ? weekIndex / (totalWeeks - 1) : 0;

  switch (phase) {
    case "ACCUMULATION":
      return 1.0; // Constant — Bondarchuk principle

    case "TRANSMUTATION":
      return 1.0; // Constant — Bondarchuk principle

    case "REALIZATION":
      return 1.0 - progress * 0.10; // Mild taper: 100% → 90%

    case "COMPETITION":
      return 0.90 - progress * 0.15; // Meet taper: 90% → 75%

    case "CLEANSE":
      return 1.0; // Constant — recovery circuit, already light

    default:
      return 1.0;
  }
}
