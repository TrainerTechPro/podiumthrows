/**
 * Bondarchuk Transfer of Training — Validation Logic
 *
 * Enforces Dr. Anatoliy Bondarchuk's implement sequencing and session
 * structure rules. Returns warnings (not hard errors) so coaches can
 * override with acknowledgment.
 *
 * Key rules (Volume IV, p.114-117):
 * 1. Implements MUST descend in weight within a throwing block (heavy → light)
 * 2. Strength blocks MUST separate consecutive throwing blocks
 * 3. Implements >20% from competition weight create separate adaptations
 */

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

/* ─── Competition Weights ───────────────────────────────────────────────── */

export const COMPETITION_WEIGHTS: Record<string, { male: number; female: number }> = {
  SHOT_PUT: { male: 7.26, female: 4.0 },
  DISCUS: { male: 2.0, female: 1.0 },
  HAMMER: { male: 7.26, female: 4.0 },
  JAVELIN: { male: 0.8, female: 0.6 },
};

/* ─── Validators ────────────────────────────────────────────────────────── */

/**
 * Rule 1: Within each throwing block, implement weights must descend.
 * 9kg → 8kg → 7.26kg = OK
 * 6kg → 8kg = FORBIDDEN (ascending)
 */
export function validateImplementSequence(blocks: BlockInput[]): ValidationResult {
  const warnings: BondarchukWarning[] = [];

  blocks.forEach((block, blockIdx) => {
    if (block.blockType !== "throwing") return;

    const throwExercises = block.exercises.filter((e) => e.implementKg != null);
    for (let i = 1; i < throwExercises.length; i++) {
      const prev = throwExercises[i - 1].implementKg!;
      const curr = throwExercises[i].implementKg!;
      if (curr > prev) {
        warnings.push({
          type: "ascending_weight",
          message: `Block "${block.name}": ${throwExercises[i].name} (${curr}kg) is heavier than preceding ${throwExercises[i - 1].name} (${prev}kg). Ascending weight order causes 2-4m performance decrease in natural athletes.`,
          severity: "error",
          blockIndex: blockIdx,
          exerciseIndex: i,
        });
      }
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
 * Rule 4: Flag implements that differ >20% from competition weight.
 * These create separate adaptations rather than positive transfer.
 */
export function validateWeightDifferential(
  implementKg: number,
  event: string,
  gender: "male" | "female" = "male"
): ValidationResult {
  const warnings: BondarchukWarning[] = [];
  const compWeights = COMPETITION_WEIGHTS[event];
  if (!compWeights) return { valid: true, warnings };

  const compWeight = compWeights[gender];
  const diffPct = Math.abs(implementKg - compWeight) / compWeight;

  if (diffPct > 0.2) {
    warnings.push({
      type: "weight_differential",
      message: `${implementKg}kg is ${Math.round(diffPct * 100)}% ${implementKg > compWeight ? "above" : "below"} competition weight (${compWeight}kg). Implements differing >15-20% create separate adaptations, not transfer.`,
      severity: "warning",
    });
  }

  return { valid: warnings.length === 0, warnings };
}

/**
 * Combined validation — runs all checks on a full session plan.
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
