"use client";

import { type Dispatch } from "react";
import { RPESlider } from "@/components/rpe-slider";
import type { SessionAction, SessionState } from "./use-session-reducer";

// ── Feeling options ──────────────────────────────────────────────────

const FEELINGS = [
  { value: "GREAT", emoji: "🔥", label: "Great" },
  { value: "GOOD", emoji: "👍", label: "Good" },
  { value: "OK", emoji: "😐", label: "OK" },
  { value: "POOR", emoji: "😕", label: "Poor" },
  { value: "BAD", emoji: "😫", label: "Bad" },
] as const;

// ── Props ────────────────────────────────────────────────────────────

interface CompletionBottomSheetProps {
  state: SessionState;
  dispatch: Dispatch<SessionAction>;
  totalThrowsLogged: number;
  bestMarks: Record<string, number>;
  onSubmit: () => void;
  onCancel: () => void;
}

// ── Component ────────────────────────────────────────────────────────

export function CompletionBottomSheet({
  state,
  dispatch,
  totalThrowsLogged,
  bestMarks,
  onSubmit,
  onCancel,
}: CompletionBottomSheetProps) {
  const { rpe, selfFeeling, sessionNotes, wasModified, modificationNotes, submitting } = state;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-white dark:bg-surface-900 rounded-t-2xl shadow-xl bottom-sheet-enter max-h-[85vh] overflow-y-auto overscroll-contain">
        {/* Handle */}
        <div className="sticky top-0 z-10 flex justify-center pt-3 pb-2 bg-white dark:bg-surface-900 rounded-t-2xl">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        <div className="px-5 pb-8 space-y-5">
          <h2 className="text-section font-heading text-gray-900 dark:text-white text-center">
            Complete Session
          </h2>

          {/* Auto-summary */}
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Throws Logged</span>
              <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                {totalThrowsLogged}
              </span>
            </div>
            {Object.entries(bestMarks).map(([impl, dist]) => (
              <div key={impl} className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-500 dark:text-gray-400">Best — {impl}</span>
                <span className="font-semibold text-primary-600 dark:text-primary-400 tabular-nums">
                  {dist}m
                </span>
              </div>
            ))}
          </div>

          {/* Feeling */}
          <div>
            <label className="label mb-2">How did you feel?</label>
            <div className="flex gap-2">
              {FEELINGS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => dispatch({ type: "SET_FEELING", payload: f.value })}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium transition-all min-h-[56px] ${
                    selfFeeling === f.value
                      ? "bg-primary-500 text-black ring-2 ring-primary-500/30"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <span className="text-base">{f.emoji}</span>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* RPE */}
          <RPESlider
            value={rpe}
            onChange={(v: number) => dispatch({ type: "SET_RPE", payload: v })}
            label="RPE"
            showDescriptions
          />

          {/* Notes */}
          <div>
            <label className="label mb-1">Notes (optional)</label>
            <textarea
              className="input w-full"
              rows={2}
              placeholder="How was the session?"
              value={sessionNotes}
              onChange={(e) => dispatch({ type: "SET_NOTES", payload: e.target.value })}
            />
          </div>

          {/* Modification toggle */}
          <div>
            <button
              type="button"
              onClick={() => dispatch({ type: "TOGGLE_MODIFIED" })}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
            >
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  wasModified
                    ? "bg-primary-500 border-primary-500"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              >
                {wasModified && (
                  <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              Session was modified from prescription
            </button>

            {wasModified && (
              <textarea
                className="input w-full mt-2"
                rows={2}
                placeholder="What did you change and why?"
                value={modificationNotes}
                onChange={(e) =>
                  dispatch({ type: "SET_MODIFICATION_NOTES", payload: e.target.value })
                }
              />
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary flex-1 py-3"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="btn-primary flex-1 py-3 font-semibold disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Save & Complete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
