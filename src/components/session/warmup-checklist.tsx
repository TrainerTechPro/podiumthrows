"use client";

import type { Dispatch } from "react";
import type { WarmupBlock, SessionAction } from "./use-session-reducer";

interface WarmupChecklistProps {
  warmups: WarmupBlock[];
  checked: Record<number, boolean>;
  dispatch: Dispatch<SessionAction>;
  hasThrows: boolean;
  hasStrength: boolean;
}

export function WarmupChecklist({
  warmups,
  checked,
  dispatch,
  hasThrows,
  hasStrength,
}: WarmupChecklistProps) {
  const allChecked = warmups.length > 0 && warmups.every((_, i) => checked[i]);

  function handleNext() {
    if (hasThrows) {
      dispatch({ type: "SET_PHASE", payload: "throws" });
    } else if (hasStrength) {
      dispatch({ type: "SET_PHASE", payload: "strength" });
    } else {
      dispatch({ type: "SET_PHASE", payload: "complete" });
    }
  }

  function handleSkip() {
    handleNext();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-section font-heading text-gray-900 dark:text-white">
          Warmup
        </h2>
        <button
          type="button"
          onClick={handleSkip}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          Skip
        </button>
      </div>

      <div className="space-y-1">
        {warmups.map((w, i) => (
          <button
            key={i}
            type="button"
            onClick={() => dispatch({ type: "TOGGLE_WARMUP", payload: i })}
            className="flex items-center gap-3 w-full text-left p-3 rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 min-h-[48px]"
          >
            {/* Checkbox */}
            <div
              className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                checked[i]
                  ? "bg-primary-500 border-primary-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              {checked[i] && (
                <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>

            {/* Label */}
            <div className="flex-1 min-w-0">
              <span
                className={`text-sm font-medium transition-colors ${
                  checked[i]
                    ? "text-gray-400 dark:text-gray-500 line-through"
                    : "text-gray-900 dark:text-white"
                }`}
              >
                {w.name}
              </span>
            </div>

            {/* Duration */}
            {w.duration && (
              <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                {w.duration}min
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Action button */}
      <div className="mt-4">
        {allChecked ? (
          <button
            type="button"
            onClick={handleNext}
            className="btn-primary w-full py-3 text-sm font-semibold"
          >
            {hasThrows ? "Start Throws" : hasStrength ? "Start Strength" : "Continue"}
          </button>
        ) : (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            Check off each item to continue
          </p>
        )}
      </div>
    </div>
  );
}
