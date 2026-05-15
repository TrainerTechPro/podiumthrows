// ── Exercise Selection Engine ────────────────────────────────────────
// Selects exercise complex for a phase using Bondarchuk correlation data,
// deficit-biased weighting, and equipment filtering.

import { getRankedExercises } from "../correlations";
import type { ExerciseType } from "../correlations";
import { STRENGTH_DB } from "../constants";
import type { Classification, TrainingPhase, MovementPlane } from "../constants";
import type {
  ExerciseComplexEntry,
  ExerciseSelectionParams,
  ImplementEntry,
  PersonalCorrelation,
} from "./types";

// ── Configuration ───────────────────────────────────────────────────

/** How many exercises per classification to target in a complex */
const COMPLEX_TARGETS: Record<Classification, { min: number; max: number }> = {
  CE: { min: 1, max: 2 }, // 1 exercise, up to 3 implements (heavy/comp/light)
  SD: { min: 1, max: 1 }, // 1 SDE per program (closely mimics competition movement)
  SP: { min: 2, max: 3 }, // 2 SPE exercises (same muscles, different pattern)
  GP: { min: 4, max: 4 }, // 4 GPE, one per movement plane (Bondarchuk methodology)
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
  phase: TrainingPhase
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
    personalCorrelations,
  } = params;

  const complex: ExerciseComplexEntry[] = [];

  // ── 1. CE exercises (competition weight full throws) ──────────
  complex.push({
    name: "Full Throw (Competition)",
    classification: "CE",
    drillType: "FULL_THROW",
    rationale:
      "Competition Exercise — full throws at competition weight. The non-negotiable transfer movement; everything else supports this.",
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
    personalCorrelations
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
      rationale: buildSdRationale(ex, deficitPrimary, previousSet),
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
    undefined,
    personalCorrelations
  );

  const spTarget = COMPLEX_TARGETS.SP;
  const selectedSp = scoredSp.slice(0, spTarget.max);

  for (const ex of selectedSp) {
    complex.push({
      name: ex.name,
      classification: "SP",
      correlationR: ex.correlationR,
      rationale: buildSpRationale(ex, deficitPrimary),
      ...getPhaseSetReps("SP", phase),
    });
  }

  // ── 4. GP exercises from STRENGTH_DB ──────────────────────────
  const gpExercises = selectGpExercises(deficitPrimary, deficitSecondary, previousSet);

  for (const ex of gpExercises) {
    complex.push({
      name: ex.name,
      classification: "GP",
      rationale: buildGpRationale(ex.plane),
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
  exercises: {
    exercise: string;
    type: ExerciseType;
    correlation: number;
    absCorrelation: number;
  }[],
  classification: Classification,
  deficitBoost: Record<Classification, number>,
  secondaryBoost: Record<Classification, number>,
  previousExercises: Set<string>,
  availableImplements: ImplementEntry[],
  transferType?: string,
  personalCorrelations?: PersonalCorrelation[]
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

    // Use blended personal correlation if available (Gap 1)
    let effectiveCorrelation = ex.absCorrelation;
    if (personalCorrelations) {
      const personal = personalCorrelations.find(
        (p) => p.exercise.toLowerCase() === ex.exercise.toLowerCase()
      );
      if (personal) effectiveCorrelation = Math.abs(personal.blendedR);
    }
    let score = effectiveCorrelation;

    // Apply deficit boost
    score *= deficitBoost[classification];
    score *= 1 + (secondaryBoost[classification] - 1) * 0.5;

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
 * Movement plane priority order for throwers.
 * TRANSVERSE (rotational) is most important for throwing performance.
 */
const GP_PLANE_ORDER: MovementPlane[] = ["TRANSVERSE", "FRONTAL", "POSTERIOR", "SAGITTAL"];

/**
 * Select GPE exercises: exactly one per movement plane (Bondarchuk methodology).
 *
 * Algorithm:
 * 1. Group GP exercises from STRENGTH_DB by movementPlane
 * 2. For each plane (in priority order), pick one exercise:
 *    a. Prefer exercises NOT in the previous complex (freshness)
 *    b. Fall back to any available if all are stale
 * 3. Skip plane if no exercises available (graceful degradation)
 */
function selectGpExercises(
  _deficitPrimary?: string,
  _deficitSecondary?: string,
  previousExercises?: Set<string>
): { name: string; id: string; plane: MovementPlane }[] {
  const gpDb = STRENGTH_DB.filter((e) => e.classification === "GP" && e.movementPlane != null);

  // Group by movement plane
  const byPlane = new Map<MovementPlane, typeof gpDb>();
  for (const ex of gpDb) {
    const plane = ex.movementPlane!;
    if (!byPlane.has(plane)) byPlane.set(plane, []);
    byPlane.get(plane)!.push(ex);
  }

  const selected: { name: string; id: string; plane: MovementPlane }[] = [];

  for (const plane of GP_PLANE_ORDER) {
    const candidates = byPlane.get(plane);
    if (!candidates || candidates.length === 0) continue;

    // Prefer exercises not in the previous complex
    const fresh = candidates.filter((e) => !previousExercises?.has(e.name.toLowerCase()));
    const pool = fresh.length > 0 ? fresh : candidates;

    // Pick one from the pool (rotate through for variety)
    const pick = pool[Math.floor(Math.random() * pool.length)];
    selected.push({ name: pick.name, id: pick.id, plane });
  }

  return selected;
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

// ── Rationale Builders ──────────────────────────────────────────────
// One-sentence "why this exercise" strings surfaced in product UI.
// Keep them legible to a coach — name the mechanism (transfer, correlation, plane)
// rather than the math.

const PLANE_LABEL: Record<MovementPlane, string> = {
  TRANSVERSE: "rotational (transverse plane)",
  FRONTAL: "lateral (frontal plane)",
  POSTERIOR: "posterior chain",
  SAGITTAL: "vertical (sagittal plane)",
};

function buildSdRationale(
  ex: ScoredExercise,
  deficitPrimary: string | undefined,
  previousSet: Set<string>
): string {
  const r = ex.correlationR.toFixed(2);
  const fresh = !previousSet.has(ex.name.toLowerCase());
  const deficitNote =
    deficitPrimary === "heavy_implement" || deficitPrimary === "light_implement"
      ? " Selected to address implement deficit."
      : "";
  const freshNote = fresh ? " New for this block — keeps the stimulus from staling." : "";
  return `Special Developmental — r=${r} with competition result.${deficitNote}${freshNote}`;
}

function buildSpRationale(ex: ScoredExercise, deficitPrimary: string | undefined): string {
  const r = ex.correlationR.toFixed(2);
  const deficitNote = deficitPrimary === "strength" ? " Reinforces strength deficit." : "";
  return `Special Preparatory — same muscle groups, different pattern (r=${r}).${deficitNote}`;
}

function buildGpRationale(plane: MovementPlane): string {
  return `General Preparatory — ${PLANE_LABEL[plane]} stimulus. One per plane per Bondarchuk methodology.`;
}

/**
 * Get phase-appropriate sets and reps ranges for a classification.
 */
function getPhaseSetReps(
  classification: Classification,
  phase: TrainingPhase
): { setsMin: number; setsMax: number; repsMin: number; repsMax: number } {
  const configs: Record<
    TrainingPhase,
    Record<Classification, { setsMin: number; setsMax: number; repsMin: number; repsMax: number }>
  > = {
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
    CLEANSE: {
      CE: { setsMin: 1, setsMax: 2, repsMin: 4, repsMax: 5 }, // Circuit-style: 4-5 throws per set
      SD: { setsMin: 1, setsMax: 1, repsMin: 4, repsMax: 5 },
      SP: { setsMin: 1, setsMax: 2, repsMin: 4, repsMax: 5 },
      GP: { setsMin: 0, setsMax: 0, repsMin: 0, repsMax: 0 }, // No GPE in cleanse
    },
  };

  return configs[phase][classification];
}
