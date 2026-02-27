// ── Strength Prescription Engine ─────────────────────────────────────
// Generates strength prescriptions using STRENGTH_DB, lifting PRs,
// and phase-appropriate loading parameters.

import { STRENGTH_DB, REST_INTERVALS } from "../constants";
import type { TrainingPhase, Classification } from "../constants";
import type {
  StrengthPrescription,
  ExerciseComplexEntry,
  LiftingPrs,
} from "./types";

// ── Loading Parameters by Phase ────────────────────────────────────

interface PhaseLoading {
  intensityMin: number; // % of 1RM
  intensityMax: number;
  setsMin: number;
  setsMax: number;
  repsMin: number;
  repsMax: number;
}

const PHASE_LOADING: Record<TrainingPhase, Record<string, PhaseLoading>> = {
  ACCUMULATION: {
    High: { intensityMin: 75, intensityMax: 85, setsMin: 4, setsMax: 5, repsMin: 4, repsMax: 8 },
    Moderate: { intensityMin: 65, intensityMax: 78, setsMin: 3, setsMax: 4, repsMin: 5, repsMax: 8 },
    Low: { intensityMin: 55, intensityMax: 65, setsMin: 3, setsMax: 3, repsMin: 6, repsMax: 10 },
    Light: { intensityMin: 40, intensityMax: 55, setsMin: 2, setsMax: 3, repsMin: 8, repsMax: 10 },
    "Very Low": { intensityMin: 40, intensityMax: 50, setsMin: 2, setsMax: 2, repsMin: 8, repsMax: 10 },
  },
  TRANSMUTATION: {
    High: { intensityMin: 80, intensityMax: 90, setsMin: 4, setsMax: 5, repsMin: 3, repsMax: 6 },
    Moderate: { intensityMin: 70, intensityMax: 82, setsMin: 3, setsMax: 4, repsMin: 4, repsMax: 6 },
    Low: { intensityMin: 60, intensityMax: 70, setsMin: 3, setsMax: 3, repsMin: 5, repsMax: 8 },
    Light: { intensityMin: 45, intensityMax: 60, setsMin: 2, setsMax: 3, repsMin: 6, repsMax: 8 },
    "Very Low": { intensityMin: 40, intensityMax: 55, setsMin: 2, setsMax: 2, repsMin: 6, repsMax: 8 },
  },
  REALIZATION: {
    High: { intensityMin: 85, intensityMax: 95, setsMin: 3, setsMax: 4, repsMin: 2, repsMax: 4 },
    Moderate: { intensityMin: 75, intensityMax: 85, setsMin: 3, setsMax: 3, repsMin: 3, repsMax: 5 },
    Low: { intensityMin: 60, intensityMax: 72, setsMin: 2, setsMax: 3, repsMin: 4, repsMax: 6 },
    Light: { intensityMin: 45, intensityMax: 60, setsMin: 2, setsMax: 2, repsMin: 5, repsMax: 6 },
    "Very Low": { intensityMin: 40, intensityMax: 50, setsMin: 2, setsMax: 2, repsMin: 5, repsMax: 6 },
  },
  COMPETITION: {
    High: { intensityMin: 80, intensityMax: 90, setsMin: 2, setsMax: 3, repsMin: 2, repsMax: 3 },
    Moderate: { intensityMin: 70, intensityMax: 80, setsMin: 2, setsMax: 3, repsMin: 2, repsMax: 4 },
    Low: { intensityMin: 55, intensityMax: 68, setsMin: 2, setsMax: 2, repsMin: 3, repsMax: 5 },
    Light: { intensityMin: 40, intensityMax: 55, setsMin: 2, setsMax: 2, repsMin: 3, repsMax: 5 },
    "Very Low": { intensityMin: 40, intensityMax: 50, setsMin: 1, setsMax: 2, repsMin: 3, repsMax: 5 },
  },
};

/** Map exercise IDs to lifting PR fields */
const EXERCISE_PR_MAP: Record<string, keyof LiftingPrs> = {
  squat: "squatKg",
  front_squat: "squatKg", // Use squat as proxy, scale down
  half_squat: "squatKg",
  bench: "benchKg",
  incline_bench: "benchKg",
  ohp: "ohpKg",
  snatch: "snatchKg",
  power_snatch: "snatchKg",
  power_clean: "cleanKg",
  clean_pull: "cleanKg",
  rdl: "deadliftKg",
  trap_deadlift: "deadliftKg",
  good_morning: "squatKg",
  glute_ham: "squatKg",
};

/** Scale factors for derivative exercises relative to the base PR */
const EXERCISE_SCALE: Record<string, number> = {
  squat: 1.0,
  front_squat: 0.82,
  half_squat: 1.15,
  bench: 1.0,
  incline_bench: 0.85,
  ohp: 0.65,
  snatch: 1.0,
  power_snatch: 0.90,
  power_clean: 1.0,
  clean_pull: 1.10,
  rdl: 0.85,
  trap_deadlift: 1.0,
  good_morning: 0.45,
  glute_ham: 0.30,
};

// ── Main Function ───────────────────────────────────────────────────

interface SelectStrengthParams {
  exerciseComplex: ExerciseComplexEntry[];
  liftingPrs: LiftingPrs;
  phase: TrainingPhase;
  strengthLevel: string; // "None" | "Light" | "Low" | "Moderate" | "High" | "Very Low"
}

/**
 * Generates strength prescriptions for a session.
 *
 * Filters the exercise complex to SP and GP classification exercises
 * that have corresponding strength movements, then calculates
 * load/sets/reps based on lifting PRs and phase parameters.
 */
export function selectStrength(params: SelectStrengthParams): StrengthPrescription[] {
  const { exerciseComplex, liftingPrs, phase, strengthLevel } = params;

  if (strengthLevel === "None") return [];

  const loading = PHASE_LOADING[phase][strengthLevel];
  if (!loading) return [];

  const restIntervals = REST_INTERVALS[phase];
  const prescriptions: StrengthPrescription[] = [];

  // Get strength-eligible exercises from complex (SP + GP classifications)
  const strengthExercises = exerciseComplex.filter(
    (e) => e.classification === "SP" || e.classification === "GP",
  );

  // Also add primary compound movements if not already in complex
  const complexNames = new Set(strengthExercises.map((e) => e.name.toLowerCase()));
  const coreLifts = getCoreLifts(strengthLevel, phase);

  for (const coreId of coreLifts) {
    const dbEntry = STRENGTH_DB.find((e) => e.id === coreId);
    if (dbEntry && !complexNames.has(dbEntry.name.toLowerCase())) {
      strengthExercises.push({
        name: dbEntry.name,
        classification: dbEntry.classification as Classification,
        setsMin: loading.setsMin,
        setsMax: loading.setsMax,
        repsMin: loading.repsMin,
        repsMax: loading.repsMax,
      });
    }
  }

  for (const exercise of strengthExercises) {
    const prescription = buildPrescription(
      exercise,
      liftingPrs,
      loading,
      restIntervals,
    );
    if (prescription) {
      prescriptions.push(prescription);
    }
  }

  return prescriptions;
}

// ── Helpers ─────────────────────────────────────────────────────────

function buildPrescription(
  exercise: ExerciseComplexEntry,
  liftingPrs: LiftingPrs,
  loading: PhaseLoading,
  restIntervals: { SP_strength: number; GP: number },
): StrengthPrescription | null {
  // Match to STRENGTH_DB entry
  const dbEntry = STRENGTH_DB.find(
    (e) => e.name.toLowerCase() === exercise.name.toLowerCase(),
  );

  const exerciseId = dbEntry?.id ?? exercise.name.toLowerCase().replace(/\s+/g, "_");
  const classification = exercise.classification;

  // Calculate load from PRs
  const { intensityPercent, loadKg } = calculateLoad(
    exerciseId,
    liftingPrs,
    loading,
  );

  // Determine sets and reps
  const sets = Math.round((loading.setsMin + loading.setsMax) / 2);
  const reps = Math.round((loading.repsMin + loading.repsMax) / 2);

  // Rest interval
  const restSeconds =
    classification === "SP"
      ? restIntervals.SP_strength
      : restIntervals.GP;

  return {
    exerciseId,
    exerciseName: exercise.name,
    classification,
    sets,
    reps,
    intensityPercent,
    loadKg,
    restSeconds,
  };
}

function calculateLoad(
  exerciseId: string,
  liftingPrs: LiftingPrs,
  loading: PhaseLoading,
): { intensityPercent: number; loadKg: number | undefined } {
  const prField = EXERCISE_PR_MAP[exerciseId];
  const scaleFactor = EXERCISE_SCALE[exerciseId] ?? 1.0;

  // Middle of intensity range
  const intensityPercent = Math.round(
    (loading.intensityMin + loading.intensityMax) / 2,
  );

  if (!prField) {
    return { intensityPercent, loadKg: undefined };
  }

  const basePr = liftingPrs[prField] as number | undefined;
  if (!basePr || basePr <= 0) {
    return { intensityPercent, loadKg: undefined };
  }

  // Estimated 1RM for this specific exercise
  const estimated1rm = basePr * scaleFactor;

  // Load = 1RM × intensity%
  const loadKg = Math.round((estimated1rm * intensityPercent) / 100 * 2) / 2; // Round to nearest 0.5kg

  return { intensityPercent, loadKg };
}

/**
 * Returns core lift IDs to include based on strength level and phase.
 */
function getCoreLifts(strengthLevel: string, phase: TrainingPhase): string[] {
  if (strengthLevel === "High") {
    return ["squat", "power_clean", "bench", "rdl"];
  }
  if (strengthLevel === "Moderate") {
    return ["squat", "bench", "power_clean"];
  }
  if (strengthLevel === "Low" || strengthLevel === "Light") {
    return ["squat", "bench"];
  }
  if (strengthLevel === "Very Low") {
    return phase === "COMPETITION" ? [] : ["squat"];
  }
  return [];
}
