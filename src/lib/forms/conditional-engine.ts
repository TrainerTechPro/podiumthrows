// ─── Conditional Logic Engine ──────────────────────────────────────────────
// Evaluates block visibility based on conditional rules at runtime

import type {
  Condition,
  ConditionGroup,
  ConditionMatrix,
  ConditionalRule,
  FormBlock,
} from "./types";

// ─── Evaluate a single condition ───────────────────────────────────────────

function evaluateCondition(
  condition: Condition,
  answers: Record<string, unknown>
): boolean {
  const answer = answers[condition.blockId];
  const { operator, value } = condition;

  switch (operator) {
    case "is":
      return answer === value;

    case "is_not":
      return answer !== value;

    case "contains": {
      if (typeof answer === "string" && typeof value === "string") {
        return answer.toLowerCase().includes(value.toLowerCase());
      }
      if (Array.isArray(answer)) {
        return answer.includes(value);
      }
      return false;
    }

    case "not_contains": {
      if (typeof answer === "string" && typeof value === "string") {
        return !answer.toLowerCase().includes(value.toLowerCase());
      }
      if (Array.isArray(answer)) {
        return !answer.includes(value);
      }
      return true;
    }

    case "greater_than": {
      const numAnswer = Number(answer);
      const numValue = Number(value);
      return !isNaN(numAnswer) && !isNaN(numValue) && numAnswer > numValue;
    }

    case "less_than": {
      const numAnswer = Number(answer);
      const numValue = Number(value);
      return !isNaN(numAnswer) && !isNaN(numValue) && numAnswer < numValue;
    }

    case "greater_equal": {
      const numAnswer = Number(answer);
      const numValue = Number(value);
      return !isNaN(numAnswer) && !isNaN(numValue) && numAnswer >= numValue;
    }

    case "less_equal": {
      const numAnswer = Number(answer);
      const numValue = Number(value);
      return !isNaN(numAnswer) && !isNaN(numValue) && numAnswer <= numValue;
    }

    case "is_empty":
      return (
        answer === undefined ||
        answer === null ||
        answer === "" ||
        (Array.isArray(answer) && answer.length === 0)
      );

    case "is_not_empty":
      return (
        answer !== undefined &&
        answer !== null &&
        answer !== "" &&
        !(Array.isArray(answer) && answer.length === 0)
      );

    default:
      return false;
  }
}

// ─── Evaluate a group (AND of conditions) ──────────────────────────────────

function evaluateGroup(
  group: ConditionGroup,
  answers: Record<string, unknown>
): boolean {
  if (group.length === 0) return true;
  return group.every((condition) => evaluateCondition(condition, answers));
}

// ─── Evaluate a matrix (OR of AND groups) ──────────────────────────────────

function evaluateMatrix(
  matrix: ConditionMatrix,
  answers: Record<string, unknown>
): boolean {
  if (matrix.length === 0) return true;
  return matrix.some((group) => evaluateGroup(group, answers));
}

// ─── Get visible block IDs ─────────────────────────────────────────────────
// Returns the list of block IDs that should be visible given current answers

export function getVisibleBlockIds(
  blocks: FormBlock[],
  rules: ConditionalRule[],
  answers: Record<string, unknown>
): string[] {
  if (rules.length === 0) {
    return blocks.map((b) => b.id);
  }

  // Build a map of targetBlockId -> rules
  const rulesByTarget = new Map<string, ConditionalRule[]>();
  for (const rule of rules) {
    const existing = rulesByTarget.get(rule.targetBlockId) || [];
    existing.push(rule);
    rulesByTarget.set(rule.targetBlockId, existing);
  }

  const visible: string[] = [];

  for (const block of blocks) {
    const blockRules = rulesByTarget.get(block.id);

    if (!blockRules || blockRules.length === 0) {
      // No rules targeting this block — always visible
      visible.push(block.id);
      continue;
    }

    let isVisible = true;

    for (const rule of blockRules) {
      const conditionsMet = evaluateMatrix(rule.conditions, answers);

      switch (rule.action) {
        case "show":
          // Show only if conditions are met
          isVisible = conditionsMet;
          break;
        case "hide":
          // Hide if conditions are met
          if (conditionsMet) isVisible = false;
          break;
        // jump_to and skip are handled by the renderer, not visibility
        case "jump_to":
        case "skip":
          break;
      }
    }

    if (isVisible) {
      visible.push(block.id);
    }
  }

  return visible;
}

// ─── Get jump target ───────────────────────────────────────────────────────
// For ONE_PER_PAGE mode: check if current block has a jump_to rule that fires

export function getJumpTarget(
  currentBlockId: string,
  rules: ConditionalRule[],
  answers: Record<string, unknown>
): string | null {
  const jumpRules = rules.filter(
    (r) =>
      r.targetBlockId === currentBlockId &&
      r.action === "jump_to" &&
      r.jumpToBlockId
  );

  for (const rule of jumpRules) {
    if (evaluateMatrix(rule.conditions, answers)) {
      return rule.jumpToBlockId!;
    }
  }

  return null;
}

// ─── Check if block should be skipped ──────────────────────────────────────

export function shouldSkipBlock(
  blockId: string,
  rules: ConditionalRule[],
  answers: Record<string, unknown>
): boolean {
  const skipRules = rules.filter(
    (r) => r.targetBlockId === blockId && r.action === "skip"
  );

  return skipRules.some((rule) => evaluateMatrix(rule.conditions, answers));
}
