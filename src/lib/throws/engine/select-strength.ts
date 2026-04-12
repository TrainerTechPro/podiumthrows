// ── Strength Prescription Engine ─────────────────────────────────────
// Generates strength prescriptions using predefined Bondarchuk Volume IV
// strength complexes with exercise-type-aware loading.
//
// Key principles:
// - Olympic lifts: 3-5 × 3-5 @ 80-120% (low reps, high intensity)
// - Compound lifts: 2-3 × 5 @ 80-85% (moderate volume)
// - Accessory/core: 2-4 × 6-10 @ fixed loads (high reps, low-moderate load)
// - Max 4-6 exercises per session
// - Complex stays FIXED for the period — stimulus variation comes from implements

import { REST_INTERVALS } from "../constants";
import type { TrainingPhase, Classification, BondarchukStrengthCategory } from "../constants";
import type {
  StrengthPrescription,
  ExerciseComplexEntry,
  LiftingPrs,
} from "./types";

// ── Exercise Type System ────────────────────────────────────────────

export type StrengthExerciseType = "OLYMPIC" | "COMPOUND" | "ACCESSORY" | "CORE";


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
  jerk: 0.85,
  rdl: 0.85,
  trap_deadlift: 1.0,
  good_morning: 0.45,
  glute_ham: 0.30,
  // New exercises added for 5-category Bondarchuk strength taxonomy
  step_up: 0.50,
  walking_lunge: 0.50,
  back_extension: 0.30,
  ab_wheel: 0,
  v_ups: 0,
  hanging_leg_raise: 0,
  plank: 0,
  plate_twist: 0,
  barbell_twist: 0,
  cable_woodchop: 0,
  kb_windmill: 0,
};

// ── Bondarchuk Volume IV Strength Complexes ─────────────────────────

export interface StrengthComplexExercise {
  exerciseId: string;
  exerciseName: string;
  type: StrengthExerciseType;
  bondarchukCategory?: BondarchukStrengthCategory; // Authentic 5-category taxonomy
  sets: number;
  reps: number;
  intensityPercent?: number; // for OLYMPIC/COMPOUND — % of 1RM
  fixedLoadKg?: number;     // for ACCESSORY/CORE — absolute weight
  prField?: keyof LiftingPrs;
  blockGroup: 1 | 2;       // 1 = primary (Olympic+Leg), 2 = accessory (Twisting+Back+Abdominal)
}

export interface StrengthComplexTemplate {
  id: string;
  name: string;
  focus: string;
  exercises: StrengthComplexExercise[];
}

/**
 * Predefined strength complexes based on Bondarchuk Volume IV.
 *
 * Each complex has exactly 5 exercises — one per Bondarchuk category:
 *   OLYMPIC + LEG (blockGroup 1 — primary, between throwing blocks)
 *   TWISTING + BACK + ABDOMINAL (blockGroup 2 — accessory, after second throwing block)
 *
 * TWISTING is the most important strength category for throwers
 * (highest correlation to throwing performance per Bondarchuk's research).
 */
export const BONDARCHUK_COMPLEXES: StrengthComplexTemplate[] = [
  {
    id: "complex_1",
    name: "Full Body — Heavy Pulls",
    focus: "posterior_chain",
    exercises: [
      // Block 1: Primary (Olympic + Leg) — between throwing blocks
      { exerciseId: "clean_pull", exerciseName: "Snatch Grip Pulls", type: "OLYMPIC", bondarchukCategory: "OLYMPIC", sets: 4, reps: 4, intensityPercent: 120, prField: "snatchKg", blockGroup: 1 },
      { exerciseId: "step_up", exerciseName: "Step-Ups to Bench", type: "COMPOUND", bondarchukCategory: "LEG", sets: 4, reps: 10, fixedLoadKg: 60, blockGroup: 1 },
      // Block 2: Accessory (Twisting + Back + Abdominal) — after second throwing block
      { exerciseId: "barbell_twist", exerciseName: "Barbell Twists", type: "ACCESSORY", bondarchukCategory: "TWISTING", sets: 3, reps: 6, fixedLoadKg: 60, blockGroup: 2 },
      { exerciseId: "good_morning", exerciseName: "Good Mornings", type: "ACCESSORY", bondarchukCategory: "BACK", sets: 4, reps: 6, fixedLoadKg: 60, blockGroup: 2 },
      { exerciseId: "hanging_leg_raise", exerciseName: "Hanging Leg Raises", type: "CORE", bondarchukCategory: "ABDOMINAL", sets: 3, reps: 9, fixedLoadKg: 0, blockGroup: 2 },
    ],
  },
  {
    id: "complex_2",
    name: "Power Emphasis",
    focus: "explosive_power",
    exercises: [
      // Block 1: Primary
      { exerciseId: "power_clean", exerciseName: "Power Cleans", type: "OLYMPIC", bondarchukCategory: "OLYMPIC", sets: 5, reps: 3, intensityPercent: 82, prField: "cleanKg", blockGroup: 1 },
      { exerciseId: "walking_lunge", exerciseName: "Walking Lunges (Barbell)", type: "COMPOUND", bondarchukCategory: "LEG", sets: 3, reps: 5, fixedLoadKg: 60, blockGroup: 1 },
      // Block 2: Accessory
      { exerciseId: "plate_twist", exerciseName: "Plate Twists", type: "ACCESSORY", bondarchukCategory: "TWISTING", sets: 3, reps: 8, fixedLoadKg: 20, blockGroup: 2 },
      { exerciseId: "rdl", exerciseName: "Romanian Deadlift", type: "ACCESSORY", bondarchukCategory: "BACK", sets: 3, reps: 6, intensityPercent: 70, prField: "deadliftKg", blockGroup: 2 },
      { exerciseId: "ab_wheel", exerciseName: "Ab Wheel Rollout", type: "CORE", bondarchukCategory: "ABDOMINAL", sets: 3, reps: 10, fixedLoadKg: 0, blockGroup: 2 },
    ],
  },
  {
    id: "complex_3",
    name: "Upper Body + Rotation",
    focus: "upper_body",
    exercises: [
      // Block 1: Primary
      { exerciseId: "power_snatch", exerciseName: "Narrow Grip Snatch", type: "OLYMPIC", bondarchukCategory: "OLYMPIC", sets: 3, reps: 5, fixedLoadKg: 60, blockGroup: 1 },
      { exerciseId: "half_squat", exerciseName: "Half Front Squat", type: "COMPOUND", bondarchukCategory: "LEG", sets: 2, reps: 5, intensityPercent: 80, prField: "squatKg", blockGroup: 1 },
      // Block 2: Accessory
      { exerciseId: "cable_woodchop", exerciseName: "Cable Woodchops", type: "ACCESSORY", bondarchukCategory: "TWISTING", sets: 3, reps: 8, fixedLoadKg: 30, blockGroup: 2 },
      { exerciseId: "back_extension", exerciseName: "Back Extensions", type: "ACCESSORY", bondarchukCategory: "BACK", sets: 3, reps: 10, fixedLoadKg: 20, blockGroup: 2 },
      { exerciseId: "v_ups", exerciseName: "V-Ups", type: "CORE", bondarchukCategory: "ABDOMINAL", sets: 3, reps: 12, fixedLoadKg: 0, blockGroup: 2 },
    ],
  },
];

// ── Phase Modulation ────────────────────────────────────────────────
// Later phases reduce SETS (volume), not the loading pattern itself.
// The exercise type dictates the reps and intensity.

interface PhaseModulation {
  setsMultiplier: number;  // applied to template sets
  restMultiplier: number;  // applied to rest intervals
}

const PHASE_MODULATION: Record<TrainingPhase, PhaseModulation> = {
  ACCUMULATION:  { setsMultiplier: 1.0,  restMultiplier: 0.85 },  // full volume, shorter rest
  TRANSMUTATION: { setsMultiplier: 0.90, restMultiplier: 1.0 },   // slight volume reduction
  REALIZATION:   { setsMultiplier: 0.75, restMultiplier: 1.15 },   // reduced volume, more rest
  COMPETITION:   { setsMultiplier: 0.50, restMultiplier: 1.25 },   // maintenance only
  CLEANSE:       { setsMultiplier: 0,    restMultiplier: 1.0 },    // no strength — bodyweight circuits only
};

// ── Main Function ───────────────────────────────────────────────────

interface SelectStrengthParams {
  exerciseComplex: ExerciseComplexEntry[];
  liftingPrs: LiftingPrs;
  phase: TrainingPhase;
  strengthLevel: string;
  strengthComplexId?: string; // selected complex template ID
  rotationIndex?: number; // which rotation cycle (0-indexed) — for sequential complex cycling
}

/**
 * Generates strength prescriptions for a session.
 *
 * Strategy:
 * 1. Select a Bondarchuk strength complex template (or use the provided one)
 * 2. Build prescriptions with type-aware loading from Volume IV
 * 3. Phase modulates volume (sets) not loading pattern
 * 4. Max 6 exercises per session
 *
 * Returns prescriptions with blockGroup metadata for session structure:
 *   blockGroup 1 = Olympic + Compound (goes between first throwing blocks)
 *   blockGroup 2 = Accessory + Core (goes after second throwing block)
 */
export function selectStrength(params: SelectStrengthParams): StrengthPrescription[] {
  const { liftingPrs, phase, strengthLevel, strengthComplexId, rotationIndex } = params;

  if (strengthLevel === "None") return [];

  const restIntervals = REST_INTERVALS[phase];
  const modulation = PHASE_MODULATION[phase];

  // Select complex template (rotation-indexed: cycles sequentially with exercise rotation)
  const complex = selectComplexTemplate(strengthComplexId, strengthLevel, phase, rotationIndex);
  if (!complex) return [];

  const prescriptions: StrengthPrescription[] = [];

  for (const exercise of complex.exercises) {
    const prescription = buildPrescriptionFromTemplate(
      exercise,
      liftingPrs,
      modulation,
      restIntervals,
      strengthLevel,
    );
    if (prescription) {
      prescriptions.push(prescription);
    }
  }

  // Cap at 6 exercises max — trim accessories first if over
  return capExercises(prescriptions, 6);
}

/**
 * Returns only the primary lifts (blockGroup 1) or accessories (blockGroup 2).
 * Used by session generator to split strength across the 4-part structure.
 */
export function splitStrengthByBlock(
  prescriptions: StrengthPrescription[],
): { primary: StrengthPrescription[]; accessory: StrengthPrescription[] } {
  return {
    primary: prescriptions.filter((p) => p.blockGroup === 1),
    accessory: prescriptions.filter((p) => p.blockGroup === 2),
  };
}

// ── Complex Selection ───────────────────────────────────────────────

/**
 * Select a strength complex template.
 *
 * Bondarchuk principle: the strength complex stays FIXED within a rotation
 * cycle and changes only when the exercise complex rotates. Sequential
 * cycling through predefined complexes provides variety across the macrocycle.
 *
 * Priority order:
 *   1. Explicit complexId override (coach/config)
 *   2. CLEANSE phase → null (no strength)
 *   3. Light/Very Low strength level → always Complex 2
 *   4. Sequential cycling by rotationIndex (0→C1, 1→C2, 2→C3, 3→C1, ...)
 */
function selectComplexTemplate(
  complexId: string | undefined,
  strengthLevel: string,
  phase?: TrainingPhase,
  rotationIndex?: number,
): StrengthComplexTemplate | null {
  // If a specific complex is requested, use it
  if (complexId) {
    return BONDARCHUK_COMPLEXES.find((c) => c.id === complexId) ?? null;
  }

  // No strength during cleanse — bodyweight circuits only
  if (phase === "CLEANSE") return null;

  // Light/Very Low strength levels → use the shorter complex (Complex 2)
  if (strengthLevel === "Light" || strengthLevel === "Very Low") {
    return BONDARCHUK_COMPLEXES.find((c) => c.id === "complex_2") ?? BONDARCHUK_COMPLEXES[0];
  }

  // Sequential cycling by rotation index
  const idx = (rotationIndex ?? 0) % BONDARCHUK_COMPLEXES.length;
  return BONDARCHUK_COMPLEXES[idx];
}

// ── Prescription Builder ────────────────────────────────────────────

function buildPrescriptionFromTemplate(
  exercise: StrengthComplexExercise,
  liftingPrs: LiftingPrs,
  modulation: PhaseModulation,
  restIntervals: { SP_strength: number; GP: number },
  strengthLevel: string,
): StrengthPrescription | null {
  // Phase-modulated sets (never below 1)
  let sets = Math.max(1, Math.round(exercise.sets * modulation.setsMultiplier));

  // Further reduce for light strength levels
  if (strengthLevel === "Light" || strengthLevel === "Very Low") {
    sets = Math.max(1, Math.round(sets * 0.7));
  }

  const reps = exercise.reps;

  // Calculate load
  const { intensityPercent, loadKg } = calculateLoadFromTemplate(
    exercise,
    liftingPrs,
  );

  // Rest intervals: Olympic/Compound get longer rest, accessories shorter
  const baseRest = exercise.type === "OLYMPIC" || exercise.type === "COMPOUND"
    ? restIntervals.SP_strength
    : restIntervals.GP;
  const restSeconds = Math.round(baseRest * modulation.restMultiplier);

  // Classification for backward compat
  const classification: Classification =
    exercise.type === "OLYMPIC" ? "SP" :
    exercise.type === "COMPOUND" ? "GP" :
    "GP";

  return {
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.exerciseName,
    classification,
    sets,
    reps,
    intensityPercent,
    loadKg,
    restSeconds,
    blockGroup: exercise.blockGroup,
  };
}

function calculateLoadFromTemplate(
  exercise: StrengthComplexExercise,
  liftingPrs: LiftingPrs,
): { intensityPercent: number | undefined; loadKg: number | undefined } {
  // Fixed-load exercises (accessories, core)
  if (exercise.fixedLoadKg !== undefined) {
    return {
      intensityPercent: undefined,
      loadKg: exercise.fixedLoadKg > 0 ? exercise.fixedLoadKg : undefined,
    };
  }

  // Percentage-based exercises (Olympic, Compound)
  if (!exercise.intensityPercent || !exercise.prField) {
    return { intensityPercent: exercise.intensityPercent, loadKg: undefined };
  }

  const basePr = liftingPrs[exercise.prField] as number | undefined;
  if (!basePr || basePr <= 0) {
    return { intensityPercent: exercise.intensityPercent, loadKg: undefined };
  }

  // Apply exercise-specific scale factor
  const scaleFactor = EXERCISE_SCALE[exercise.exerciseId] ?? 1.0;
  const estimated1rm = basePr * scaleFactor;

  // Load = estimated 1RM * intensity%
  const loadKg = Math.round((estimated1rm * exercise.intensityPercent) / 100 * 2) / 2;

  return {
    intensityPercent: exercise.intensityPercent,
    loadKg,
  };
}

// ── Exercise Cap ────────────────────────────────────────────────────

/**
 * Cap exercises to maxCount. If over, trim CORE first, then ACCESSORY.
 * Olympic and Compound lifts are always preserved.
 */
function capExercises(
  prescriptions: StrengthPrescription[],
  maxCount: number,
): StrengthPrescription[] {
  if (prescriptions.length <= maxCount) return prescriptions;

  // Separate by block group for priority trimming
  const primary = prescriptions.filter((p) => p.blockGroup === 1);
  const accessory = prescriptions.filter((p) => p.blockGroup === 2);

  // Keep all primary, trim accessory to fit
  const maxAccessory = maxCount - primary.length;
  return [...primary, ...accessory.slice(0, Math.max(0, maxAccessory))];
}
