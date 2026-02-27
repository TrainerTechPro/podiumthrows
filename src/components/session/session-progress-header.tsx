"use client";

import Link from "next/link";
import type { SessionState } from "./use-session-reducer";

interface SessionProgressHeaderProps {
  state: SessionState;
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
  totalThrowsLogged,
  totalThrowBlocks,
  overallProgress,
}: SessionProgressHeaderProps) {
  const { session, currentPhase, currentBlockIndex } = state;
  if (!session) return null;

  const phaseLabel = PHASE_LABELS[currentPhase] ?? currentPhase;
  const totalTarget = session.totalThrowsTarget;

  return (
    <div className="sticky top-0 z-30 mobile-header-blur border-b border-gray-200/60 dark:border-gray-800/60">
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
  );
}
