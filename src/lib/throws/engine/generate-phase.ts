// ── Phase Generator ─────────────────────────────────────────────────
// Builds a complete training phase (mesocycle) with exercise complex
// selection, volume targets, and week-by-week sessions.

import { PHASE_CONFIGS, PHASE_IMPLEMENT_DIST } from "../constants";
import type { TrainingPhase } from "../constants";
import { selectExercises } from "./select-exercises";
import { scaleVolume } from "./scale-volume";
import { generateWeek } from "./generate-week";
import { computeAdaptiveWave } from "./adaptive-waves";
import { computeTaper } from "./elite-taper";
import type {
  GeneratedPhase,
  PhaseGenConfig,
} from "./types";

// ── Main Function ───────────────────────────────────────────────────

/**
 * Generate a complete training phase (mesocycle).
 *
 * 1. Selects the exercise complex using correlations + deficit bias
 * 2. Calculates scaled volume targets
 * 3. Generates each week within the phase
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

  // ── Select exercise complex ──────────────────────────────────
  const exerciseComplex = selectExercises(
    {
      eventCode: programConfig.eventCode,
      genderCode: programConfig.genderCode,
      distanceBand: programConfig.distanceBand,
      availableImplements: programConfig.availableImplements,
      deficitPrimary: programConfig.deficitPrimary,
      deficitSecondary: programConfig.deficitSecondary,
      transferType: programConfig.transferType,
      personalCorrelations: programConfig.personalCorrelations,
    },
    phase,
  );

  // ── Calculate volume targets ─────────────────────────────────
  const volumeTargets = scaleVolume(phase, programConfig);

  // ── Generate weeks ───────────────────────────────────────────
  const weeks = [];

  for (let w = 0; w < durationWeeks; w++) {
    const weekNumber = startWeek + w;

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

    // Exercise complex
    exerciseComplex,

    // Generated weeks
    weeks,
  };
}

// ── Progressive Overload ────────────────────────────────────────────

/**
 * Returns a volume multiplier for progressive overload within a phase.
 *
 * Pattern varies by phase:
 * - ACCUMULATION: Linear ramp up (0.85 → 1.10), deload last week
 * - TRANSMUTATION: Moderate ramp (0.90 → 1.05), deload last week
 * - REALIZATION: Slight taper (1.0 → 0.85)
 * - COMPETITION: Taper down (0.80 → 0.60)
 */
function getProgressFactor(
  weekIndex: number,
  totalWeeks: number,
  phase: TrainingPhase,
): number {
  const progress = totalWeeks > 1 ? weekIndex / (totalWeeks - 1) : 0;
  const isLastWeek = weekIndex === totalWeeks - 1;

  switch (phase) {
    case "ACCUMULATION":
      if (isLastWeek && totalWeeks > 3) return 0.75; // Deload week
      return 0.85 + progress * 0.25; // 85% → 110%

    case "TRANSMUTATION":
      if (isLastWeek && totalWeeks > 2) return 0.80; // Deload week
      return 0.90 + progress * 0.15; // 90% → 105%

    case "REALIZATION":
      return 1.0 - progress * 0.15; // 100% → 85%

    case "COMPETITION":
      return 0.80 - progress * 0.20; // 80% → 60%

    default:
      return 1.0;
  }
}
