// ─── Answer Piping ─────────────────────────────────────────────────────────
// Resolves {{block:id}} merge tags in block labels and descriptions

import type { FormBlock } from "./types";

const MERGE_TAG_PATTERN = /\{\{block:([a-zA-Z0-9_-]+)\}\}/g;

// ─── Resolve merge tags in a string ────────────────────────────────────────

export function resolveMergeTags(
  text: string,
  answers: Record<string, unknown>,
  blocks: FormBlock[]
): string {
  if (!text.includes("{{block:")) return text;

  const blockMap = new Map(blocks.map((b) => [b.id, b]));

  return text.replace(MERGE_TAG_PATTERN, (_match, blockId: string) => {
    const answer = answers[blockId];
    if (answer === undefined || answer === null) return "___";

    // Format based on block type
    const block = blockMap.get(blockId);
    if (!block) return String(answer);

    return formatAnswer(answer, block);
  });
}

// ─── Format an answer for display ──────────────────────────────────────────

function formatAnswer(answer: unknown, block: FormBlock): string {
  if (answer === undefined || answer === null || answer === "") return "___";

  switch (block.type) {
    case "distance":
      return `${answer}${block.unit === "meters" ? "m" : "ft"}`;

    case "duration": {
      return String(answer);
    }

    case "body_map": {
      if (Array.isArray(answer)) {
        if (
          answer.length > 0 &&
          typeof answer[0] === "object" &&
          answer[0] !== null
        ) {
          return (answer as Array<{ region: string }>)
            .map((a) => a.region)
            .join(", ");
        }
        return answer.join(", ");
      }
      return String(answer);
    }

    case "implement_select": {
      if (Array.isArray(answer)) {
        return answer.map((w) => `${w}kg`).join(", ");
      }
      return `${answer}kg`;
    }

    case "ranking": {
      if (Array.isArray(answer)) {
        return answer.join(" → ");
      }
      return String(answer);
    }

    case "multiple_choice": {
      if (Array.isArray(answer)) {
        return answer.join(", ");
      }
      return String(answer);
    }

    case "matrix": {
      if (typeof answer === "object" && answer !== null) {
        return Object.entries(answer as Record<string, unknown>)
          .map(([row, val]) => `${row}: ${val}`)
          .join("; ");
      }
      return String(answer);
    }

    default:
      return String(answer);
  }
}

// ─── Check if text contains merge tags ─────────────────────────────────────

export function hasMergeTags(text: string): boolean {
  return text.includes("{{block:");
}

// ─── Extract block IDs referenced by merge tags ────────────────────────────

export function extractMergeTagBlockIds(text: string): string[] {
  const ids: string[] = [];
  const pattern = /\{\{block:([a-zA-Z0-9_-]+)\}\}/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}
