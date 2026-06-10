import type { NarrativeInput, NarrativeOutput } from "@/lib/contracts";

/**
 * F7 hard rule: the model may reference ONLY numbers present in the input
 * JSON. Every numeral in the narrative must be numerically equal to a number
 * that appears in the input (as a JSON number or inside an input string,
 * e.g. a drill named "3-Turn Entry"). "38.20" matches 38.2; "17" does not
 * match anything unless 17 is actually in the input.
 *
 * Also enforced here (same reject-retry-fallback path):
 * - coachSummary ≤ 120 words (PRD F7)
 * - drillSelections ⊆ input.drillOptions (the LLM never invents drills)
 */

const NUMERAL_RE = /\d+(?:\.\d+)?/g;
export const MAX_SUMMARY_WORDS = 120;

export function collectAllowedNumbers(input: NarrativeInput): Set<number> {
  const allowed = new Set<number>();
  for (const match of JSON.stringify(input).match(NUMERAL_RE) ?? []) {
    allowed.add(Number.parseFloat(match));
  }
  return allowed;
}

export interface ValidationResult {
  ok: boolean;
  violations: string[];
}

export function validateNarrative(
  output: NarrativeOutput,
  input: NarrativeInput
): ValidationResult {
  const allowed = collectAllowedNumbers(input);
  const violations: string[] = [];

  const texts: Array<[string, string]> = [
    ["coachSummary", output.coachSummary],
    ...output.phaseCommentary.map(
      (p, i) => [`phaseCommentary[${i}] (${p.phase})`, p.comment] as [string, string]
    ),
    ...output.drillSelections.map(
      (d, i) => [`drillSelections[${i}].rationale`, d.rationale] as [string, string]
    ),
  ];

  for (const [where, text] of texts) {
    for (const match of text.match(NUMERAL_RE) ?? []) {
      if (!allowed.has(Number.parseFloat(match))) {
        violations.push(`${where}: numeral "${match}" is not present in the input JSON`);
      }
    }
  }

  const words = output.coachSummary.trim().split(/\s+/).filter(Boolean).length;
  if (words > MAX_SUMMARY_WORDS) {
    violations.push(`coachSummary: ${words} words exceeds the ${MAX_SUMMARY_WORDS}-word limit`);
  }

  const allowedDrillIds = new Set(input.drillOptions.map((d) => d.id));
  for (const sel of output.drillSelections) {
    if (!allowedDrillIds.has(sel.drillId)) {
      violations.push(`drillSelections: drill "${sel.drillId}" is not in the provided library`);
    }
  }

  return { ok: violations.length === 0, violations };
}
