"use client";

import { useState, useEffect, useRef, type Dispatch } from "react";
import Link from "next/link";
import type { SessionState, SessionAction } from "./use-session-reducer";
import { csrfHeaders } from "@/lib/csrf-client";

interface SessionProgressHeaderProps {
  state: SessionState;
  dispatch: Dispatch<SessionAction>;
  totalThrowsLogged: number;
  totalThrowBlocks: number;
  overallProgress: number;
}

const PHASE_LABELS: Record<string, string> = {
  warmup: "Warmup",
  throws: "Throws",
  strength: "Strength",
  complete: "Review",
  summary: "Done",
};

export function SessionProgressHeader({
  state,
  dispatch,
  totalThrowsLogged,
  totalThrowBlocks,
  overallProgress,
}: SessionProgressHeaderProps) {
  const { session, currentPhase, currentBlockIndex, intraEval } = state;
  if (!session) return null;

  const phaseLabel = PHASE_LABELS[currentPhase] ?? currentPhase;
  const totalTarget = session.totalThrowsTarget;

  return (
    <div className="sticky top-0 z-30">
      <div className="mobile-header-blur border-b border-gray-200/60 dark:border-gray-800/60">
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Back */}
          <Link
            href="/coach/my-program"
            className="flex-shrink-0 -ml-1 p-1 text-gray-500 hover:text-primary-600 transition-colors"
            aria-label="Back to program"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          {/* Center: progress */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {phaseLabel}
              </span>
              {currentPhase === "throws" && totalTarget > 0 && (
                <span className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums">
                  {totalThrowsLogged}/{totalTarget}
                </span>
              )}
            </div>
            {/* Progress bar */}
            {totalTarget > 0 && (
              <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all duration-500 ease-out"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            )}
          </div>

          {/* Right: block indicator */}
          {currentPhase === "throws" && totalThrowBlocks > 0 && (
            <span className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 tabular-nums">
              {Math.min(currentBlockIndex + 1, totalThrowBlocks)}/{totalThrowBlocks}
            </span>
          )}
        </div>
      </div>

      {/* Intra-eval banner */}
      <IntraEvalBanner
        intraEval={intraEval}
        dispatch={dispatch}
        programId={session.programId}
      />
    </div>
  );
}

// ── Intra-Eval Banner ─────────────────────────────────────────────────

function IntraEvalBanner({
  intraEval,
  dispatch,
  programId,
}: {
  intraEval: SessionState["intraEval"];
  dispatch: Dispatch<SessionAction>;
  programId: string;
}) {
  const [applying, setApplying] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss applied banner after 8 seconds
  useEffect(() => {
    if (intraEval.status === "applied") {
      dismissTimer.current = setTimeout(() => {
        dispatch({ type: "INTRA_EVAL_DISMISS" });
      }, 8000);
      return () => {
        if (dismissTimer.current) clearTimeout(dismissTimer.current);
      };
    }
  }, [intraEval.status, dispatch]);

  if (intraEval.status === "idle" || intraEval.status === "none") {
    return null;
  }

  // Evaluating — spinner
  if (intraEval.status === "evaluating") {
    return (
      <div className="px-4 py-2.5 border-b border-gray-200/60 dark:border-gray-800/60 bg-surface-50 dark:bg-surface-900/50">
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-3.5 w-3.5 text-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-xs text-muted">Checking readiness...</span>
        </div>
      </div>
    );
  }

  // Applied — green banner
  if (intraEval.status === "applied" && intraEval.suggestion) {
    return (
      <div className="px-4 py-2.5 border-b border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20">
        <div className="flex items-start gap-2">
          <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium shrink-0 mt-px">
            &#10003; Block 2 adjusted automatically
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => dispatch({ type: "INTRA_EVAL_DISMISS" })}
            className="text-emerald-500/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shrink-0 -mt-0.5"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/70 mt-0.5 leading-relaxed">
          {intraEval.suggestion.reasoning}
        </p>
      </div>
    );
  }

  // Suggestion pending — amber banner
  if (intraEval.status === "suggestion_pending" && intraEval.suggestion) {
    const suggestion = intraEval.suggestion;

    const handleApply = async () => {
      setApplying(true);
      try {
        const res = await fetch(
          `/api/throws/program/${programId}/suggestions/${suggestion.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ action: "APPROVE" }),
          },
        );
        if (res.ok) {
          dispatch({
            type: "INTRA_EVAL_RESULT",
            payload: {
              suggestion: { ...suggestion, autoApplied: false },
              applied: true,
            },
          });
        }
      } catch {
        // Non-blocking — session continues
      } finally {
        setApplying(false);
      }
    };

    return (
      <div className="px-4 py-2.5 border-b border-amber-200/60 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20">
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
          Readiness check — adjustment suggested
        </p>
        <p className="text-[11px] text-amber-700/80 dark:text-amber-300/70 mt-0.5 leading-relaxed">
          {suggestion.reasoning}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={handleApply}
            disabled={applying}
            className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 transition-colors"
          >
            {applying ? "Applying..." : "Apply"}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "INTRA_EVAL_DISMISS" })}
            className="text-[11px] font-medium px-2.5 py-1 rounded-md text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return null;
}
