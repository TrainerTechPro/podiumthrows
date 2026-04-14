// Bondarchuk implement-sequencing primitive.
//
// Within a single throwing sequence, competition-implement weights must be
// monotonically non-increasing (heavy → light). Ascending order causes a
// 2-4m performance decrease in natural athletes (Vol IV, p.114-117).
//
// Null weights (bodyweight, medicine ball, unweighted drills) sit outside
// the competition-implement sequence and are ignored by this check.
//
// Pure function. No side effects. No framework imports.

export type SequencingExercise = {
  implementWeightKg: number | null;
  orderIndex: number;
};

export type SequencingResult =
  | { ok: true }
  | { ok: false; violation: string; offendingIndex: number };

export function validateImplementSequence(
  exercises: ReadonlyArray<SequencingExercise>
): SequencingResult {
  const ordered = [...exercises].sort((a, b) => a.orderIndex - b.orderIndex);

  let previousWeighted: SequencingExercise | null = null;

  for (const current of ordered) {
    if (current.implementWeightKg == null) continue;

    if (previousWeighted && current.implementWeightKg > previousWeighted.implementWeightKg!) {
      return {
        ok: false,
        violation: `${current.implementWeightKg}kg cannot follow ${previousWeighted.implementWeightKg}kg — descending weight order required (heavier must come first).`,
        offendingIndex: current.orderIndex,
      };
    }

    previousWeighted = current;
  }

  return { ok: true };
}
