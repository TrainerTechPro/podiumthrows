"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/Toast";

/**
 * Helper hook for surfacing the "you have an unfinished log" toast.
 *
 * Forms call `useDraftResumeToast()` and invoke the returned function inside
 * a one-shot mount effect when `useDraftPersistence` reports `hasDraft` and
 * the saved timestamp is older than the threshold (default 2 minutes).
 *
 * Why a hook and not a JSX component: the toast system is push-style — you
 * enqueue from any callsite. Wrapping it in a hook keeps the single
 * `useToast()` consumer pattern that the rest of the app uses.
 *
 * Two actions:
 *   - "Discard" (primary)  → clears the draft + resets the form
 *   - "Continue" (secondary) → dismisses the toast; the form already has the
 *                              draft loaded, so this is functionally a no-op
 */

const DEFAULT_THRESHOLD_MS = 2 * 60 * 1000;

export interface DraftResumeToastOptions {
  /** Date the draft was last persisted (from useDraftPersistence). */
  lastSavedAt: Date;
  /** Called when the athlete chooses to discard the saved draft. */
  onDiscard: () => void | Promise<void>;
  /**
   * Optional handler for the secondary "Continue" action. Useful when the
   * draft maps to a transient surface (e.g. a sheet that needs reopening).
   * Defaults to a no-op — the form already loaded the draft, so dismiss is
   * sometimes all that's needed.
   */
  onContinue?: () => void | Promise<void>;
  /**
   * Optional override for the staleness threshold below which no toast is
   * shown. Defaults to 2 minutes — within that window the user almost
   * certainly knows the draft is theirs (they just left the form).
   */
  thresholdMs?: number;
  /**
   * Optional friendlier label for what kind of work was unfinished
   * (e.g. "throw", "session", "questionnaire"). Defaults to "log".
   */
  noun?: string;
}

export function useDraftResumeToast() {
  const toastApi = useToast();

  return useCallback(
    (opts: DraftResumeToastOptions): string | null => {
      const threshold = opts.thresholdMs ?? DEFAULT_THRESHOLD_MS;
      const ageMs = Date.now() - opts.lastSavedAt.getTime();
      if (ageMs < threshold) return null;

      const noun = opts.noun ?? "log";

      return toastApi.toast({
        variant: "info",
        title: `You have an unfinished ${noun}`,
        description: `Last edited ${formatRelative(opts.lastSavedAt)}.`,
        duration: 0, // persistent until user chooses
        action: {
          label: "Discard",
          onClick: () => {
            void opts.onDiscard();
          },
        },
        secondaryAction: {
          label: "Continue",
          onClick: () => {
            if (opts.onContinue) void opts.onContinue();
            // Otherwise the form already loaded the draft — dismiss is enough.
          },
        },
      });
    },
    [toastApi]
  );
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
