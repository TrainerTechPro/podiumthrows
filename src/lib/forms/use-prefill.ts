"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mergePrefill, isAbsent, type AnswerMap } from "@/lib/forms/prefill";
import { logger } from "@/lib/logger";

const TOGGLE_PREFIX = "podium:questionnaire:useprev:";

function readToggle(questionnaireId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(TOGGLE_PREFIX + questionnaireId);
    return raw === null ? true : raw === "1";
  } catch (err) {
    // ok: localStorage may be blocked (Safari private mode, restricted
    // cookies). Toggle still works for the session, just won't persist.
    logger.debug("prefill toggle read failed", {
      context: "use-prefill",
      metadata: { err: err instanceof Error ? err.message : String(err) },
    });
    return true;
  }
}

function writeToggle(questionnaireId: string, on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOGGLE_PREFIX + questionnaireId, on ? "1" : "0");
  } catch (err) {
    // ok: localStorage may be blocked. Non-fatal — preference is in-memory
    // for the session.
    logger.debug("prefill toggle write failed", {
      context: "use-prefill",
      metadata: { err: err instanceof Error ? err.message : String(err) },
    });
  }
}

interface UsePrefillOptions {
  questionnaireId: string;
  /** All known question/block IDs in the *current* form definition. */
  knownIds: string[];
  /** The answers currently rendered in the form (post-merge). */
  answers: AnswerMap;
  /** Setter for the form's answers state. */
  setAnswers: (next: AnswerMap | ((prev: AnswerMap) => AnswerMap)) => void;
  /** Initial draft sourced from the server (`QuestionnaireAssignment.draftAnswers`). */
  draftAnswers: AnswerMap | null | undefined;
  /** Disables the network call (useful for tests or when the form is read-only). */
  enabled?: boolean;
}

export interface UsePrefillResult {
  /** Whether previous-answers prefill is currently active. */
  useToggle: boolean;
  /** Toggle setter — applies/removes prefill in-place. */
  setUseToggle: (next: boolean) => void;
  /** True once the previous-answers fetch has resolved (success or empty). */
  loaded: boolean;
  /** Raw map of the athlete's previous answers, keyed by id. */
  previousAnswers: AnswerMap;
  /** When the previous response was submitted (ISO), or null. */
  previousCompletedAt: string | null;
  /** IDs whose currently-rendered value came from `previousAnswers`. */
  prefilledIds: Set<string>;
  /** Mark a field as user-edited so the "From last time" badge dismisses. */
  dismissPrefill: (id: string) => void;
}

/**
 * Hook that fetches an athlete's previous answers for a questionnaire and
 * applies them as a prefill once on load. Subsequent toggle changes
 * apply/clear the prefill against the current draft.
 */
export function usePrefill({
  questionnaireId,
  knownIds,
  answers,
  setAnswers,
  draftAnswers,
  enabled = true,
}: UsePrefillOptions): UsePrefillResult {
  const [previousAnswers, setPreviousAnswers] = useState<AnswerMap>({});
  const [previousCompletedAt, setPreviousCompletedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [useToggle, setUseToggleState] = useState<boolean>(() => readToggle(questionnaireId));
  const [prefilledIds, setPrefilledIds] = useState<Set<string>>(new Set());

  // Stable refs for ids/draft so the apply effect doesn't re-fire on every
  // answers mutation (only when the response itself or the toggle changes).
  const knownIdsRef = useRef(knownIds);
  knownIdsRef.current = knownIds;
  const draftRef = useRef(draftAnswers ?? {});
  draftRef.current = draftAnswers ?? {};
  const appliedRef = useRef(false);

  // Fetch previous answers once.
  useEffect(() => {
    if (!enabled) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/athlete/questionnaires/${questionnaireId}/previous-answers`, {
          credentials: "same-origin",
        });
        const payload = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !payload?.success) {
          // Don't surface an error toast — prefill is a quiet enhancement.
          // First-time fills hit this path with a 200/empty result, but a
          // 4xx/5xx is logged for diagnostics only.
          if (res.status !== 200) {
            logger.warn("previous-answers fetch failed", {
              context: "use-prefill",
              metadata: { status: res.status },
            });
          }
          setLoaded(true);
          return;
        }
        const data = payload.data as {
          previousAnswers: AnswerMap;
          completedAt: string | null;
        };
        setPreviousAnswers(data.previousAnswers ?? {});
        setPreviousCompletedAt(data.completedAt ?? null);
      } catch (err) {
        logger.warn("previous-answers fetch error", {
          context: "use-prefill",
          metadata: { err: err instanceof Error ? err.message : String(err) },
        });
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questionnaireId, enabled]);

  // Apply prefill once after both the previous-answers fetch resolves and
  // the form's initial answers settle.
  useEffect(() => {
    if (!loaded) return;
    if (appliedRef.current) return;
    appliedRef.current = true;

    const { merged, prefilledIds: nextPrefilled } = mergePrefill({
      draft: draftRef.current,
      previous: previousAnswers,
      knownIds: knownIdsRef.current,
      useToggle,
    });

    // Only update fields that prefill actually changed — don't clobber any
    // late-arriving draft state. We use the current `answers` snapshot but
    // intentionally do *not* depend on it in this effect's dep array (would
    // cause repeated firing on every keystroke).
    setAnswers((current) => {
      const next: AnswerMap = { ...current };
      let changed = false;
      for (const id of knownIdsRef.current) {
        if (id in merged && isAbsent(current[id])) {
          next[id] = merged[id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
    setPrefilledIds(nextPrefilled);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: one-shot apply on load
  }, [loaded, previousAnswers]);

  // Dismiss a field's prefill badge when the user edits it.
  const dismissPrefill = useCallback((id: string) => {
    setPrefilledIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Watch for user edits — answers that change away from the prefilled value
  // should drop their badge. We detect this by comparing against
  // `previousAnswers[id]`.
  useEffect(() => {
    if (prefilledIds.size === 0) return;
    let mutated = false;
    const next = new Set(prefilledIds);
    for (const id of prefilledIds) {
      const current = answers[id];
      const prev = previousAnswers[id];
      if (!shallowAnswerEqual(current, prev)) {
        next.delete(id);
        mutated = true;
      }
    }
    if (mutated) setPrefilledIds(next);
  }, [answers, prefilledIds, previousAnswers]);

  // Toggle handler: applies or clears prefill against the current answers.
  const setUseToggle = useCallback(
    (nextOn: boolean) => {
      setUseToggleState(nextOn);
      writeToggle(questionnaireId, nextOn);

      if (nextOn) {
        // Re-apply prefill: fill in any field that's currently empty.
        setAnswers((current) => {
          const next: AnswerMap = { ...current };
          const newPrefilled = new Set<string>();
          for (const id of knownIdsRef.current) {
            const prev = previousAnswers[id];
            if (isAbsent(prev)) continue;
            if (isAbsent(current[id])) {
              next[id] = prev;
              newPrefilled.add(id);
            }
          }
          setPrefilledIds(newPrefilled);
          return next;
        });
      } else {
        // Clear all currently-prefilled fields. User-edited fields are
        // already out of `prefilledIds`, so this only touches values the
        // user hasn't touched.
        setAnswers((current) => {
          const next: AnswerMap = { ...current };
          for (const id of prefilledIds) {
            delete next[id];
          }
          return next;
        });
        setPrefilledIds(new Set());
      }
    },
    [questionnaireId, previousAnswers, prefilledIds, setAnswers]
  );

  return useMemo(
    () => ({
      useToggle,
      setUseToggle,
      loaded,
      previousAnswers,
      previousCompletedAt,
      prefilledIds,
      dismissPrefill,
    }),
    [
      useToggle,
      setUseToggle,
      loaded,
      previousAnswers,
      previousCompletedAt,
      prefilledIds,
      dismissPrefill,
    ]
  );
}

function shallowAnswerEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  return false;
}
