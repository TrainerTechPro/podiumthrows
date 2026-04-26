/**
 * Prefill merge logic for repeat-fill questionnaires.
 *
 * When an athlete opens a questionnaire they've filled before, prefill the
 * matching questions/blocks with their most recent submitted answer. The
 * draft (current in-progress edit) always wins over a previous answer.
 *
 * Precedence: draft > previous (when toggle on) > undefined.
 */

export type AnswerMap = Record<string, unknown>;

export interface MergePrefillInput {
  /** What the user has saved as a draft for *this* in-progress fill. */
  draft: AnswerMap | null | undefined;
  /** The athlete's most recent submitted answers, keyed by question/block id. */
  previous: AnswerMap | null | undefined;
  /** Question/block IDs that exist in the *current* form definition. Prevents
   *  resurfacing values for questions that were since removed. */
  knownIds: string[];
  /** "Use previous answers" toggle. False = no prefill applied. */
  useToggle: boolean;
}

export interface MergePrefillResult {
  merged: AnswerMap;
  /** Subset of knownIds whose value came from `previous`, not `draft`. */
  prefilledIds: Set<string>;
}

/**
 * Treat a value as "absent" (so we should fall through to prefill) when it is
 * undefined, null, an empty string, or an empty array. Explicitly preserves
 * 0, false, and other falsy-but-meaningful values per CLAUDE.md rule 3.
 */
export function isAbsent(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

export function mergePrefill({
  draft,
  previous,
  knownIds,
  useToggle,
}: MergePrefillInput): MergePrefillResult {
  const merged: AnswerMap = {};
  const prefilledIds = new Set<string>();
  const draftMap = draft ?? {};
  const previousMap = previous ?? {};

  for (const id of knownIds) {
    const draftValue = draftMap[id];
    if (!isAbsent(draftValue)) {
      merged[id] = draftValue;
      continue;
    }

    if (useToggle) {
      const prevValue = previousMap[id];
      if (!isAbsent(prevValue)) {
        merged[id] = prevValue;
        prefilledIds.add(id);
      }
    }
  }

  // Preserve any draft entries for IDs that aren't in knownIds — the form
  // definition could have changed but we don't want to silently drop user
  // input. The renderer will ignore them; the server validates against the
  // current schema on submit.
  for (const [id, value] of Object.entries(draftMap)) {
    if (knownIds.includes(id)) continue;
    if (isAbsent(value)) continue;
    merged[id] = value;
  }

  return { merged, prefilledIds };
}

/**
 * Normalize a `QuestionnaireResponse.answers` JSON payload into a flat
 * `{ id: answer }` record. Handles both the legacy question-array shape
 * `[{ questionId, answer }]` and the block-array shape
 * `[{ blockId, answer }]`.
 */
export function answersArrayToMap(answers: unknown): AnswerMap {
  if (!Array.isArray(answers)) return {};
  const map: AnswerMap = {};
  for (const entry of answers) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { questionId?: string; blockId?: string; answer?: unknown };
    const id = e.blockId ?? e.questionId;
    if (typeof id !== "string" || id === "") continue;
    if (isAbsent(e.answer)) continue;
    map[id] = e.answer;
  }
  return map;
}
