// ── Exercise Selection Engine ────────────────────────────────────────
// Selects exercise complex for a phase using Bondarchuk correlation data,
// deficit-biased weighting, and equipment filtering.

import { getRankedExercises } from "../correlations";
import type { ExerciseType } from "../correlations";
import { STRENGTH_DB } from "../constants";
import type { Classification, TrainingPhase } from "../constants";
import type {
  ExerciseComplexEntry,
  ExerciseSelectionParams,
  ImplementEntry,
} from "./types";

// ── Configuration ───────────────────────────────────────────────────

/** How many exercises per classification to target in a complex */
const COMPLEX_TARGETS: Record<Classification, { min: number; max: number }> = {
  CE: { min: 1, max: 2 },
  SD: { min: 2, max: 4 },
  SP: { min: 2, max: 3 },
  GP: { min: 2, max: 4 },
};

/** Deficit bias multipliers — when a deficit exists, boost that category */
const DEFICIT_BOOST: Record<string, Record<Classification, number>> = {
  heavy_implement: { CE: 1.0, SD: 1.3, SP: 1.1, GP: 1.0 },
  light_implement: { CE: 1.0, SD: 1.3, SP: 1.1, GP: 1.0 },
  strength: { CE: 1.0, SD: 0.9, SP: 1.3, GP: 1.4 },
  balanced: { CE: 1.0, SD: 1.0, SP: 1.0, GP: 1.0 },
  none: { CE: 1.0, SD: 1.0, SP: 1.0, GP: 1.0 },
};

/** Transfer type bias — adjust SD selection for heavy vs competition dominant */
const TRANSFER_BIAS: Record<string, "heavy" | "light" | "balanced"> = {
  "heavy-dominant": "heavy",
  "competition-dominant": "balanced",
  balanced: "balanced",
};

// ── Main Selection Function ─────────────────────────────────────────

/**
 * Selects the exercise complex for a training phase.
 *
 * Algorithm:
 * 1. Get ranked exercises from Bondarchuk correlation database for athlete's level
 * 2. Score each exercise: |correlation| × deficitBoost × freshnessBonus
 * 3. Filter SD exercises by available implements
 * 4. Select top N per classification (CE, SD, SP, GP)
 * 5. Assign sets/reps ranges based on phase
 */
export function selectExercises(
  params: ExerciseSelectionParams,
  phase: TrainingPhase,
): ExerciseComplexEntry[] {
  const {
    eventCode,
    genderCode,
    distanceBand,
    availableImplements,
    deficitPrimary,
    deficitSecondary,
    transferType,
    previousComplexExercises,
  } = params;

  const complex: ExerciseComplexEntry[] = [];

  // ── 1. CE exercises (competition weight full throws) ──────────
  complex.push({
    name: "Full Throw (Competition)",
    classification: "CE",
    drillType: "FULL_THROW",
    ...getPhaseSetReps("CE", phase),
  });

  // ── 2. SD exercises from correlation database ─────────────────
  const ranked = getRankedExercises(eventCode, genderCode, distanceBand);
  const sdExercises = ranked.filter((e) => e.type === "SD");
  const spExercises = ranked.filter((e) => e.type === "SP");

  const deficitBoost = DEFICIT_BOOST[deficitPrimary ?? "none"] ?? DEFICIT_BOOST.none;
  const secondaryBoost = DEFICIT_BOOST[deficitSecondary ?? "none"] ?? DEFICIT_BOOST.none;
  const previousSet = new Set(previousComplexExercises?.map((e) => e.toLowerCase()) ?? []);

  // Score and rank SD exercises
  const scoredSd = scoreExercises(
    sdExercises,
    "SD",
    deficitBoost,
    secondaryBoost,
    previousSet,
    availableImplements,
    transferType,
  );

  // Pick top SD exercises
  const sdTarget = COMPLEX_TARGETS.SD;
  const selectedSd = scoredSd.slice(0, sdTarget.max);

  for (const ex of selectedSd) {
    complex.push({
      name: ex.name,
      classification: "SD",
      correlationR: ex.correlationR,
      implementKg: ex.implementKg,
      drillType: inferDrillType(ex.name),
      ...getPhaseSetReps("SD", phase),
    });
  }

  // ── 3. SP exercises from correlation database ─────────────────
  const scoredSp = scoreExercises(
    spExercises,
    "SP",
    deficitBoost,
    secondaryBoost,
    previousSet,
    availableImplements,
  );

  const spTarget = COMPLEX_TARGETS.SP;
  const selectedSp = scoredSp.slice(0, spTarget.max);

  for (const ex of selectedSp) {
    complex.push({
      name: ex.name,
      classification: "SP",
      correlationR: ex.correlationR,
      ...getPhaseSetReps("SP", phase),
    });
  }

  // ── 4. GP exercises from STRENGTH_DB ──────────────────────────
  const gpExercises = selectGpExercises(deficitPrimary, deficitSecondary, previousSet);

  for (const ex of gpExercises) {
    complex.push({
      name: ex.name,
      classification: "GP",
      ...getPhaseSetReps("GP", phase),
    });
  }

  return complex;
}

// ── Scoring Helpers ─────────────────────────────────────────────────

interface ScoredExercise {
  name: string;
  correlationR: number;
  score: number;
  implementKg?: number;
}

function scoreExercises(
  exercises: { exercise: string; type: ExerciseType; correlation: number; absCorrelation: number }[],
  classification: Classification,
  deficitBoost: Record<Classification, number>,
  secondaryBoost: Record<Classification, number>,
  previousExercises: Set<string>,
  availableImplements: ImplementEntry[],
  transferType?: string,
): ScoredExercise[] {
  const ownedWeights = new Set(availableImplements.map((i) => i.weightKg));
  const transferBias = TRANSFER_BIAS[transferType ?? "balanced"] ?? "balanced";

  const scored: ScoredExercise[] = [];

  for (const ex of exercises) {
    // For SD exercises, check if athlete owns the implement
    let implementKg: number | undefined;
    if (classification === "SD") {
      implementKg = extractImplementWeight(ex.exercise);
      if (implementKg !== undefined && !ownedWeights.has(implementKg)) {
        continue; // Skip exercises requiring implements the athlete doesn't have
      }
    }

    let score = ex.absCorrelation;

    // Apply deficit boost
    score *= deficitBoost[classification];
    score *= (1 + (secondaryBoost[classification] - 1) * 0.5);

    // Freshness bonus: exercises NOT in previous complex get a boost
    if (!previousExercises.has(ex.exercise.toLowerCase())) {
      score *= 1.15;
    }

    // Transfer type bias for SD exercises
    if (classification === "SD" && implementKg !== undefined) {
      if (transferBias === "heavy" && implementKg > 7.26) {
        score *= 1.1;
      } else if (transferBias === "light" && implementKg < 7.26) {
        score *= 1.1;
      }
    }

    scored.push({
      name: ex.exercise,
      correlationR: ex.correlation,
      score,
      implementKg,
    });
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Select GP exercises from STRENGTH_DB based on deficit priorities.
 */
function selectGpExercises(
  deficitPrimary?: string,
  deficitSecondary?: string,
  previousExercises?: Set<string>,
): { name: string; id: string }[] {
  const gpDb = STRENGTH_DB.filter((e) => e.classification === "GP");
  const spDb = STRENGTH_DB.filter((e) => e.classification === "SP");
  const target = COMPLEX_TARGETS.GP;

  // Prioritize based on deficit
  const priorities: string[] = [];

  if (deficitPrimary === "strength" || deficitSecondary === "strength") {
    // Heavy emphasis on compound movements
    priorities.push("squat", "bench", "front_squat", "rdl", "trap_deadlift");
  } else {
    // Balanced — include some of everything
    priorities.push("squat", "bench", "ohp", "rdl");
  }

  const selected: { name: string; id: string }[] = [];
  const usedIds = new Set<string>();

  // First add priority exercises
  for (const id of priorities) {
    if (selected.length >= target.max) break;
    const ex = [...gpDb, ...spDb].find((e) => e.id === id);
    if (ex && !usedIds.has(ex.id)) {
      // Freshness check
      if (!previousExercises?.has(ex.name.toLowerCase())) {
        selected.push({ name: ex.name, id: ex.id });
        usedIds.add(ex.id);
      }
    }
  }

  // Fill remaining slots with other GP exercises
  for (const ex of gpDb) {
    if (selected.length >= target.max) break;
    if (!usedIds.has(ex.id)) {
      selected.push({ name: ex.name, id: ex.id });
      usedIds.add(ex.id);
    }
  }

  return selected.slice(0, target.max);
}

// ── Utility Helpers ─────────────────────────────────────────────────

/**
 * Extract implement weight from exercise name.
 * e.g. "5kg Hammer" → 5, "8kg Shot" → 8, "16kg Weight" → 16
 */
function extractImplementWeight(exerciseName: string): number | undefined {
  const match = exerciseName.match(/^([\d.]+)kg/);
  if (match) return parseFloat(match[1]);
  return undefined;
}

/**
 * Infer drill type from exercise name for SD exercises.
 */
function inferDrillType(exerciseName: string): string {
  const lower = exerciseName.toLowerCase();
  if (lower.includes("place") || lower.includes("standing")) return "STANDING";
  if (lower.includes("half")) return "HALF_TURN";
  if (lower.includes("forward")) return "STANDING";
  if (lower.includes("backward")) return "STANDING";
  return "FULL_THROW";
}

/**
 * Get phase-appropriate sets and reps ranges for a classification.
 */
function getPhaseSetReps(
  classification: Classification,
  phase: TrainingPhase,
): { setsMin: number; setsMax: number; repsMin: number; repsMax: number } {
  const configs: Record<TrainingPhase, Record<Classification, { setsMin: number; setsMax: number; repsMin: number; repsMax: number }>> = {
    ACCUMULATION: {
      CE: { setsMin: 3, setsMax: 5, repsMin: 3, repsMax: 6 },
      SD: { setsMin: 3, setsMax: 5, repsMin: 3, repsMax: 6 },
      SP: { setsMin: 3, setsMax: 4, repsMin: 3, repsMax: 5 },
      GP: { setsMin: 3, setsMax: 4, repsMin: 6, repsMax: 10 },
    },
    TRANSMUTATION: {
      CE: { setsMin: 4, setsMax: 6, repsMin: 3, repsMax: 5 },
      SD: { setsMin: 3, setsMax: 5, repsMin: 3, repsMax: 5 },
      SP: { setsMin: 3, setsMax: 4, repsMin: 3, repsMax: 5 },
      GP: { setsMin: 3, setsMax: 4, repsMin: 4, repsMax: 8 },
    },
    REALIZATION: {
      CE: { setsMin: 4, setsMax: 6, repsMin: 2, repsMax: 4 },
      SD: { setsMin: 3, setsMax: 4, repsMin: 2, repsMax: 4 },
      SP: { setsMin: 2, setsMax: 3, repsMin: 2, repsMax: 4 },
      GP: { setsMin: 2, setsMax: 3, repsMin: 3, repsMax: 6 },
    },
    COMPETITION: {
      CE: { setsMin: 2, setsMax: 3, repsMin: 2, repsMax: 3 },
      SD: { setsMin: 2, setsMax: 3, repsMin: 2, repsMax: 3 },
      SP: { setsMin: 1, setsMax: 2, repsMin: 2, repsMax: 3 },
      GP: { setsMin: 1, setsMax: 2, repsMin: 3, repsMax: 5 },
    },
  };

  return configs[phase][classification];
}
