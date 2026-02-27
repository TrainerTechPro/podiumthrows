// ── Complex Manager ───────────────────────────────────────────────────
// Manages exercise complex rotation per Bondarchuk methodology.
// When an athlete reaches sports form or readaptation risk, the complex
// must rotate to provide fresh stimulus.

import { selectExercises } from "./select-exercises";
import type { TrainingPhase } from "../constants";
import type {
  ComplexRotationParams,
  ExerciseComplexEntry,
  ExerciseSelectionParams,
} from "./types";

// ── Configuration ─────────────────────────────────────────────────────

/** Minimum proportion of exercises that must change in a rotation */
const MIN_CHANGE_RATIO = 0.4;

/** Maximum exercises to retain from previous complex (continuity) */
const MAX_RETAINED = 2;

// ── Main Function ─────────────────────────────────────────────────────

/**
 * Generate a new exercise complex that differs meaningfully from previous ones.
 *
 * Strategy:
 * 1. Run fresh exercise selection from the correlation database
 * 2. Check overlap with the current complex
 * 3. If too similar, demote retained exercises and re-select
 * 4. Ensure the competition exercise (CE) is always included
 *
 * The new complex maintains training continuity by keeping 1-2 effective
 * exercises while introducing fresh stimulus through new selections.
 */
export function rotateComplex(
  params: ComplexRotationParams,
): ExerciseComplexEntry[] {
  const { programConfig, currentComplex, allPreviousComplexes } = params;
  const phase: TrainingPhase = params.phase ?? "ACCUMULATION";

  // Build selection params from program config
  const selectionParams: ExerciseSelectionParams = {
    eventCode: programConfig.eventCode,
    genderCode: programConfig.genderCode,
    distanceBand: programConfig.distanceBand,
    availableImplements: programConfig.availableImplements,
    deficitPrimary: programConfig.deficitPrimary,
    deficitSecondary: programConfig.deficitSecondary,
    transferType: programConfig.transferType,
    previousComplexExercises: currentComplex.map((e) => e.name),
  };

  // Get fresh selection
  let newComplex = selectExercises(selectionParams, phase);

  // Calculate overlap with current complex
  const currentNames = new Set(currentComplex.map((e) => e.name));
  const retained = newComplex.filter((e) => currentNames.has(e.name));
  const fresh = newComplex.filter((e) => !currentNames.has(e.name));

  // If too many retained, swap some out
  if (retained.length > MAX_RETAINED && fresh.length > 0) {
    // Keep the top MAX_RETAINED by correlation score, replace the rest
    const sortedRetained = [...retained].sort(
      (a, b) => (b.correlationR ?? 0) - (a.correlationR ?? 0),
    );
    const keep = sortedRetained.slice(0, MAX_RETAINED);
    const _keepNames = new Set(keep.map((e) => e.name));

    newComplex = [
      ...keep,
      ...fresh,
      ...newComplex.filter(
        (e) => !currentNames.has(e.name) && !fresh.includes(e),
      ),
    ].slice(0, currentComplex.length || 8);
  }

  // Verify minimum change ratio
  const changeCount = newComplex.filter(
    (e) => !currentNames.has(e.name),
  ).length;
  const changeRatio = newComplex.length > 0
    ? changeCount / newComplex.length
    : 1;

  if (changeRatio < MIN_CHANGE_RATIO) {
    // Force more variety by excluding all previous complex exercises
    const allPreviousNames = new Set(
      allPreviousComplexes.flat().map((e) => e.name),
    );
    const forcedFresh = selectExercises({
      ...selectionParams,
      previousComplexExercises: [...allPreviousNames],
    }, phase);

    if (forcedFresh.length > 0) {
      newComplex = forcedFresh;
    }
  }

  return newComplex;
}

/**
 * Check if two complexes are sufficiently different.
 */
export function complexesAreDifferent(
  a: ExerciseComplexEntry[],
  b: ExerciseComplexEntry[],
  minDifference = MIN_CHANGE_RATIO,
): boolean {
  const namesA = new Set(a.map((e) => e.name));
  const overlap = b.filter((e) => namesA.has(e.name)).length;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return true;
  return (maxLen - overlap) / maxLen >= minDifference;
}

/**
 * Get a summary of what changed between two complexes.
 */
export function complexDiff(
  previous: ExerciseComplexEntry[],
  next: ExerciseComplexEntry[],
): {
  added: string[];
  removed: string[];
  retained: string[];
} {
  const prevNames = new Set(previous.map((e) => e.name));
  const nextNames = new Set(next.map((e) => e.name));

  return {
    added: next.filter((e) => !prevNames.has(e.name)).map((e) => e.name),
    removed: previous.filter((e) => !nextNames.has(e.name)).map((e) => e.name),
    retained: next.filter((e) => prevNames.has(e.name)).map((e) => e.name),
  };
}
