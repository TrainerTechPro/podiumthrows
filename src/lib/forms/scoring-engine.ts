// ─── Scoring Engine ────────────────────────────────────────────────────────
// Calculates per-block scores and composite scores from form answers

import type {
  BlockAnswer,
  BlockScoringRule,
  CompositeScoringRule,
  FormBlock,
  ScoringConfig,
} from "./types";

// ─── Score a single block ──────────────────────────────────────────────────

export function scoreBlock(
  answer: unknown,
  block: FormBlock,
  rule: BlockScoringRule
): number {
  if (answer === undefined || answer === null || answer === "") return 0;

  // If a scoring map is provided, look up the answer value
  if (rule.scoringMap) {
    const key = String(answer);
    const score = rule.scoringMap[key];
    if (score !== undefined) return Math.min(score, rule.maxPoints);
  }

  // Numeric types: normalize to 0-maxPoints range
  if (
    block.type === "scale_1_5" ||
    block.type === "scale_1_10" ||
    block.type === "rpe" ||
    block.type === "slider" ||
    block.type === "number"
  ) {
    const numVal = Number(answer);
    if (isNaN(numVal)) return 0;

    let min = 1;
    let max = 10;

    if (block.type === "scale_1_5") {
      max = 5;
    } else if (block.type === "scale_1_10" || block.type === "rpe") {
      max = 10;
    } else if (block.type === "slider") {
      min = block.min;
      max = block.max;
    } else if (block.type === "number") {
      min = block.min ?? 0;
      max = block.max ?? 100;
    }

    // Normalize to 0-1 range
    const range = max - min;
    if (range === 0) return 0;

    let normalized = (numVal - min) / range;

    // Invert if needed (e.g., soreness: 10 = bad = low score)
    if (rule.invertScale) {
      normalized = 1 - normalized;
    }

    return Math.round(normalized * rule.maxPoints * 10) / 10;
  }

  // Yes/No: yes = maxPoints, no = 0 (or inverted)
  if (block.type === "yes_no") {
    const isYes = String(answer).toLowerCase() === "yes";
    if (rule.invertScale) {
      return isYes ? 0 : rule.maxPoints;
    }
    return isYes ? rule.maxPoints : 0;
  }

  // Likert: index-based scoring
  if (block.type === "likert") {
    const idx = block.scale.indexOf(String(answer));
    if (idx === -1) return 0;
    const normalized = idx / (block.scale.length - 1);
    const score = rule.invertScale
      ? (1 - normalized) * rule.maxPoints
      : normalized * rule.maxPoints;
    return Math.round(score * 10) / 10;
  }

  // Default: if answer exists and matches expected, full points
  return 0;
}

// ─── Score all blocks ──────────────────────────────────────────────────────

export function scoreAllBlocks(
  answers: Record<string, unknown>,
  blocks: FormBlock[],
  config: ScoringConfig
): BlockAnswer[] {
  const blockMap = new Map(blocks.map((b) => [b.id, b]));
  const ruleMap = new Map(config.rules.map((r) => [r.blockId, r]));

  return blocks
    .filter(
      (b) =>
        b.type !== "welcome_screen" &&
        b.type !== "thank_you_screen" &&
        b.type !== "section_header"
    )
    .map((block) => {
      const answer = answers[block.id];
      const rule = ruleMap.get(block.id);
      const score = rule
        ? scoreBlock(answer, blockMap.get(block.id)!, rule)
        : undefined;

      return {
        blockId: block.id,
        blockLabel: block.label,
        blockType: block.type,
        answer: answer ?? null,
        score,
      };
    });
}

// ─── Calculate composite score ─────────────────────────────────────────────

export function calculateCompositeScore(
  blockAnswers: BlockAnswer[],
  composite: CompositeScoringRule
): number | null {
  const scoredBlocks = blockAnswers.filter(
    (a) => a.score !== undefined && a.score !== null
  );

  if (scoredBlocks.length === 0) return null;

  switch (composite.formula) {
    case "sum": {
      return scoredBlocks.reduce((sum, a) => sum + (a.score ?? 0), 0);
    }

    case "average": {
      const total = scoredBlocks.reduce((sum, a) => sum + (a.score ?? 0), 0);
      return Math.round((total / scoredBlocks.length) * 10) / 10;
    }

    case "weighted_average": {
      if (!composite.blockWeights) {
        // Fall back to simple average
        const total = scoredBlocks.reduce((sum, a) => sum + (a.score ?? 0), 0);
        return Math.round((total / scoredBlocks.length) * 10) / 10;
      }

      let weightedSum = 0;
      let totalWeight = 0;

      for (const block of scoredBlocks) {
        const weight = composite.blockWeights[block.blockId] ?? 1;
        weightedSum += (block.score ?? 0) * weight;
        totalWeight += weight;
      }

      if (totalWeight === 0) return null;
      return Math.round((weightedSum / totalWeight) * 10) / 10;
    }

    default:
      return null;
  }
}

// ─── Full scoring pipeline ─────────────────────────────────────────────────

export function calculateFormScores(
  answers: Record<string, unknown>,
  blocks: FormBlock[],
  config: ScoringConfig
): {
  blockScores: BlockAnswer[];
  compositeScore: number | null;
  maxPossibleScore: number;
} {
  const blockScores = scoreAllBlocks(answers, blocks, config);

  const compositeScore = config.composite
    ? calculateCompositeScore(blockScores, config.composite)
    : null;

  const maxPossibleScore = config.rules.reduce(
    (sum, r) => sum + r.maxPoints,
    0
  );

  return { blockScores, compositeScore, maxPossibleScore };
}
