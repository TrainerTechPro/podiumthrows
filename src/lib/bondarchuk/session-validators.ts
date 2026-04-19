/**
 * Bondarchuk Transfer of Training — Session-level validators
 *
 * Operate on BlockInput[] (a structured session plan). Internally compose
 * the exercise-level primitive from ./sequencing so the monotonic rule has
 * a single source of truth.
 *
 * Key rules (Volume IV, p.114-117):
 * 1. Implements MUST descend in weight within a throwing block (heavy → light)
 * 2. Strength blocks MUST separate consecutive throwing blocks
 * 3. Later throwing blocks should use equal or lighter implements
 */

import { validateImplementSequence as validateExerciseSequence } from "./sequencing";

/* ─── Types ─────────────────────────────────────────────────────────────── */

export type BondarchukWarning = {
  type:
    | "ascending_weight"
    | "consecutive_throwing"
    | "weight_differential"
    | "cross_block_ascending";
  message: string;
  severity: "error" | "warning";
  blockIndex?: number;
  exerciseIndex?: number;
};

export type ValidationResult = {
  valid: boolean;
  warnings: BondarchukWarning[];
};

export type BlockInput = {
  name: string;
  blockType: string; // "throwing" | "strength" | "warmup" | "cooldown"
  exercises: ExerciseInput[];
};

export type ExerciseInput = {
  name: string;
  implementKg?: number | null;
};

/* ─── Validators ────────────────────────────────────────────────────────── */

/**
 * Rule 1: Within each throwing block, implement weights must descend.
 *
 * Composes the exercise-level primitive (./sequencing.validateImplementSequence)
 * so the monotonic rule is defined in ONE place. This function adds
 * session-level reporting: per-block iteration, warning shape with block/exercise
 * indices, and support for multiple throwing blocks in one session.
 */
export function validateImplementSequence(blocks: BlockInput[]): ValidationResult {
  const warnings: BondarchukWarning[] = [];

  blocks.forEach((block, blockIdx) => {
    if (block.blockType !== "throwing") return;

    // Keep only exercises with an implement weight — match the primitive's contract.
    const weighted = block.exercises
      .map((exercise, exerciseIndex) => ({ exercise, exerciseIndex }))
      .filter(({ exercise }) => exercise.implementKg != null);

    const primitiveResult = validateExerciseSequence(
      weighted.map(({ exercise, exerciseIndex }) => ({
        implementWeightKg: exercise.implementKg!,
        orderIndex: exerciseIndex,
      }))
    );

    if (!primitiveResult.ok) {
      const offender = weighted.find(
        ({ exerciseIndex }) => exerciseIndex === primitiveResult.offendingIndex
      );
      // Find preceding weighted exercise for the message
      const offenderPosition = weighted.findIndex(
        ({ exerciseIndex }) => exerciseIndex === primitiveResult.offendingIndex
      );
      const predecessor = offenderPosition > 0 ? weighted[offenderPosition - 1] : null;

      warnings.push({
        type: "ascending_weight",
        message:
          predecessor && offender
            ? `Block "${block.name}": ${offender.exercise.name} (${offender.exercise.implementKg}kg) is heavier than preceding ${predecessor.exercise.name} (${predecessor.exercise.implementKg}kg). Ascending weight order causes 2-4m performance decrease in natural athletes.`
            : primitiveResult.violation,
        severity: "error",
        blockIndex: blockIdx,
        exerciseIndex: offender?.exerciseIndex,
      });
    }
  });

  return { valid: warnings.length === 0, warnings };
}

/**
 * Rule 2: No two consecutive throwing blocks — strength must separate them.
 * Warmup and cooldown blocks don't count as separators.
 */
export function validateBlockStructure(blocks: BlockInput[]): ValidationResult {
  const warnings: BondarchukWarning[] = [];
  let lastThrowingIdx = -1;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.blockType === "warmup" || block.blockType === "cooldown") continue;

    if (block.blockType === "throwing") {
      if (lastThrowingIdx >= 0) {
        // Check if there's a strength block between lastThrowingIdx and i
        let hasStrengthBetween = false;
        for (let j = lastThrowingIdx + 1; j < i; j++) {
          if (blocks[j].blockType === "strength") {
            hasStrengthBetween = true;
            break;
          }
        }
        if (!hasStrengthBetween) {
          warnings.push({
            type: "consecutive_throwing",
            message: `"${blocks[lastThrowingIdx].name}" and "${block.name}" are consecutive throwing blocks with no strength block between them. Strength blocks enable passive activation transfer.`,
            severity: "error",
            blockIndex: i,
          });
        }
      }
      lastThrowingIdx = i;
    }
  }

  return { valid: warnings.length === 0, warnings };
}

/**
 * Rule 3: Across throwing blocks, later blocks should use equal or lighter implements.
 */
export function validateCrossBlockSequence(blocks: BlockInput[]): ValidationResult {
  const warnings: BondarchukWarning[] = [];
  const throwingBlocks = blocks
    .map((b, i) => ({ block: b, index: i }))
    .filter(({ block }) => block.blockType === "throwing");

  for (let i = 1; i < throwingBlocks.length; i++) {
    const prevBlock = throwingBlocks[i - 1];
    const currBlock = throwingBlocks[i];

    // Get heaviest implement in each block
    const prevMax = Math.max(
      ...prevBlock.block.exercises
        .filter((e) => e.implementKg != null)
        .map((e) => e.implementKg!),
      0
    );
    const currMax = Math.max(
      ...currBlock.block.exercises
        .filter((e) => e.implementKg != null)
        .map((e) => e.implementKg!),
      0
    );

    if (currMax > prevMax && prevMax > 0) {
      warnings.push({
        type: "cross_block_ascending",
        message: `"${currBlock.block.name}" uses heavier implements (${currMax}kg) than earlier "${prevBlock.block.name}" (${prevMax}kg). Later throwing blocks should use equal or lighter implements.`,
        severity: "warning",
        blockIndex: currBlock.index,
      });
    }
  }

  return { valid: warnings.length === 0, warnings };
}

/**
 * Combined validation — runs all session-level checks.
 */
export function validateFullSession(blocks: BlockInput[]): ValidationResult {
  const results = [
    validateImplementSequence(blocks),
    validateBlockStructure(blocks),
    validateCrossBlockSequence(blocks),
  ];

  const allWarnings = results.flatMap((r) => r.warnings);
  return {
    valid: allWarnings.length === 0,
    warnings: allWarnings,
  };
}
