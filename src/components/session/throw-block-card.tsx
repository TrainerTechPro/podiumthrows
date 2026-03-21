"use client";

import { useRef, useState, useEffect, type Dispatch } from "react";
import { InlineRestTimer } from "./inline-rest-timer";
import type {
  ThrowBlock,
  ThrowEntry,
  SessionAction,
} from "./use-session-reducer";

// ── Constants ────────────────────────────────────────────────────────

const DRILL_LABELS: Record<string, string> = {
  FULL_THROW: "Full Throw",
  STANDING: "Standing",
  HALF_TURN: "Half Turn",
  ONE_TURN: "1 Turn",
  TWO_TURN: "2 Turns",
  THREE_TURN: "3 Turns",
  FOUR_TURN: "4 Turns",
  WINDS: "Winds Only",
  DRILL: "Drill",
  OTHER: "Other",
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  CE: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  SD: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  SDE: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  SP: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  SPE: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  GP: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
  GPE: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
};

// ── Props ────────────────────────────────────────────────────────────

interface ThrowBlockCardProps {
  block: ThrowBlock;
  blockIndex: number;
  currentSetIndex: number;
  blockThrows: ThrowEntry[];
  bestMark: number | null;
  isLastBlock: boolean;
  restActive: boolean;
  restSeconds: number;
  dispatch: Dispatch<SessionAction>;
  onLogThrow: (entry: ThrowEntry) => void;
  onAdvanceBlock: () => void;
}

// ── Component ────────────────────────────────────────────────────────

export function ThrowBlockCard({
  block,
  blockIndex: _blockIndex,
  currentSetIndex,
  blockThrows,
  bestMark,
  isLastBlock,
  restActive,
  restSeconds,
  dispatch,
  onLogThrow,
  onAdvanceBlock,
}: ThrowBlockCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [distance, setDistance] = useState("");

  const totalTarget = block.sets * block.repsPerSet;
  const throwsLogged = blockThrows.length;
  const blockComplete = throwsLogged >= totalTarget;

  // Current set throws
  const currentSetStart = currentSetIndex * block.repsPerSet;
  const currentSetEnd = currentSetStart + block.repsPerSet;
  const currentSetThrows = blockThrows.slice(currentSetStart, currentSetEnd);
  const currentSetComplete = currentSetThrows.length >= block.repsPerSet;

  // Auto-focus input when not resting
  useEffect(() => {
    if (!restActive && !blockComplete && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [restActive, blockComplete, currentSetIndex]);

  function handleLog() {
    const d = parseFloat(distance);
    if (isNaN(d) || d <= 0) return;

    const entry: ThrowEntry = {
      distance: d,
      implement: block.implement,
      drillType: block.drillType,
      throwNumber: throwsLogged + 1,
      synced: false,
    };

    onLogThrow(entry);
    setDistance("");

    // Re-focus after logging
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLog();
    }
  }

  function handleRestComplete() {
    dispatch({ type: "REST_COMPLETE" });
    dispatch({ type: "ADVANCE_SET" });
  }

  const drillLabel = DRILL_LABELS[block.drillType] ?? block.drillType;
  const categoryColor = CLASSIFICATION_COLORS[block.category] ?? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";

  return (
    <div className="card animate-fade-in">
      {/* Block header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-md font-semibold ${categoryColor}`}>
            {block.category}
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {block.implement}
          </span>
        </div>
        {/* Best mark badge */}
        {bestMark !== null && bestMark > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 tabular-nums animate-scale-spring">
            Best: {bestMark}m
          </span>
        )}
      </div>

      {/* Drill + target info */}
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        {drillLabel} &middot; {block.sets * block.repsPerSet} throws &middot; {block.restSeconds}s rest
      </p>

      {block.notes && (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-3">{block.notes}</p>
      )}

      {/* Set progress dots */}
      <div className="flex items-center gap-1.5 mb-4">
        {Array.from({ length: block.sets }).map((_, setIdx) => {
          const setStart = setIdx * block.repsPerSet;
          const setThrows = blockThrows.slice(setStart, setStart + block.repsPerSet);
          const setDone = setThrows.length >= block.repsPerSet;
          const isCurrent = setIdx === currentSetIndex && !blockComplete;

          return (
            <div
              key={setIdx}
              className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                setDone
                  ? "bg-primary-500"
                  : isCurrent
                    ? "bg-primary-300 dark:bg-primary-700 animate-subtle-pulse"
                    : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          );
        })}
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 tabular-nums">
          {throwsLogged}/{totalTarget}
        </span>
      </div>

      {/* Logged throws in current set */}
      {currentSetThrows.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {currentSetThrows.map((t, i) => (
            <span
              key={i}
              className="text-sm font-semibold tabular-nums px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {t.distance}m
              {!t.synced && (
                <span className="ml-1 text-xs text-gray-400">...</span>
              )}
            </span>
          ))}
          {/* Empty slots */}
          {!currentSetComplete &&
            Array.from({ length: block.repsPerSet - currentSetThrows.length }).map((_, i) => (
              <span
                key={`empty-${i}`}
                className="text-sm tabular-nums px-2.5 py-1 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-gray-400"
              >
                —
              </span>
            ))}
        </div>
      )}

      {/* Rest timer (shown after completing a set's reps) */}
      {restActive && restSeconds > 0 && (
        <InlineRestTimer
          seconds={restSeconds}
          onComplete={handleRestComplete}
          autoStart
        />
      )}

      {/* Distance input + Log (hidden during rest and when block complete) */}
      {!restActive && !blockComplete && (
        <div className="flex gap-2 mt-2">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            className="input flex-1 text-center text-lg font-semibold tabular-nums"
            placeholder="Distance (m)"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={handleLog}
            disabled={!distance}
            className="btn-primary px-6 py-3 text-sm font-semibold disabled:opacity-40"
          >
            Log
          </button>
        </div>
      )}

      {/* Block complete — next action */}
      {blockComplete && !restActive && (
        <div className="mt-3">
          <button
            type="button"
            onClick={onAdvanceBlock}
            className="btn-primary w-full py-3 text-sm font-semibold"
          >
            {isLastBlock ? "Done with Throws" : "Next Block"}
          </button>
        </div>
      )}
    </div>
  );
}
