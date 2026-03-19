"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SkipForward, StickyNote, History } from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface ExerciseLogState {
  id: string;
  exerciseName: string;
  order: number;
  sets: number | null;
  reps: number | null;
  load: number | null;
  loadUnit: string;
  duration: number | null;
  isSkipped: boolean;
  isAdded: boolean;
  isModified: boolean;
  previousLoad: number | null;
  notes: string | null;
  programExerciseId: string | null;
}

interface Prescribed {
  prescribedSets: number;
  prescribedReps: string | null;
  prescribedDuration: string | null;
  isIsometric: boolean;
}

export interface ExerciseRowProps {
  index: number;
  log: ExerciseLogState;
  prescribed: Prescribed | null;
  onChange: (updated: ExerciseLogState) => void;
  onNameClick: (name: string) => void;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function ExerciseRow({
  index,
  log,
  prescribed,
  onChange,
  onNameClick,
}: ExerciseRowProps) {
  const [showNotes, setShowNotes] = useState(!!log.notes);
  const isIso = prescribed?.isIsometric ?? false;

  function update(partial: Partial<ExerciseLogState>) {
    onChange({ ...log, ...partial });
  }

  function handleLoadChange(value: string) {
    const parsed = value === "" ? null : parseFloat(value);
    update({ load: parsed, isModified: true });
  }

  function handleDurationChange(value: string) {
    const parsed = value === "" ? null : parseInt(value, 10);
    update({ duration: parsed, isModified: true });
  }

  function toggleSkip() {
    update({ isSkipped: !log.isSkipped });
  }

  function toggleNotes() {
    setShowNotes((v) => !v);
  }

  /* Delta badge (load difference from previousLoad) */
  const delta =
    log.previousLoad != null && log.load != null
      ? log.load - log.previousLoad
      : null;

  /* Prescribed label: "1x15" or "1x30s" */
  const prescribedLabel = prescribed
    ? isIso
      ? `${prescribed.prescribedSets}\u00D7${prescribed.prescribedDuration ?? "30s"}`
      : `${prescribed.prescribedSets}\u00D7${prescribed.prescribedReps ?? "?"}`
    : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-3 rounded-lg transition-colors",
        "hover:bg-surface-50 dark:hover:bg-surface-800/50",
        log.isSkipped && "opacity-50",
        log.isAdded && "border-l-2 border-primary-400"
      )}
    >
      {/* Main row */}
      <div className="flex items-start gap-3">
        {/* Row number */}
        <span className="text-xs font-medium text-surface-400 dark:text-surface-500 w-5 pt-1.5 text-right shrink-0">
          {index + 1}.
        </span>

        {/* Exercise name + prescribed */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onNameClick(log.exerciseName)}
              className={cn(
                "text-sm font-medium text-surface-900 dark:text-surface-100",
                "hover:underline hover:text-primary-600 dark:hover:text-primary-400",
                "transition-colors text-left",
                log.isSkipped && "line-through"
              )}
            >
              {log.exerciseName}
            </button>

            {prescribedLabel && (
              <span className="text-xs text-surface-400 dark:text-surface-500">
                {prescribedLabel}
              </span>
            )}

            {log.isAdded && (
              <span className="text-[10px] font-medium bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 px-1.5 py-0.5 rounded">
                Added
              </span>
            )}

            {log.isModified && !log.isAdded && (
              <span className="text-[10px] font-medium bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 px-1.5 py-0.5 rounded">
                Modified
              </span>
            )}
          </div>

          {/* Input row */}
          <div className="flex items-center gap-2 mt-1.5">
            {isIso ? (
              /* Isometric: duration input */
              <>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={log.duration ?? ""}
                  onChange={(e) => handleDurationChange(e.target.value)}
                  placeholder="—"
                  disabled={log.isSkipped}
                  className="bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg px-3 py-1.5 w-20 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 disabled:opacity-40"
                />
                <span className="text-xs text-surface-500 dark:text-surface-400">
                  sec
                </span>
                <span className="text-xs text-surface-400 dark:text-surface-500 ml-1">
                  Bodyweight
                </span>
              </>
            ) : (
              /* Standard: load input */
              <>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={log.load ?? ""}
                  onChange={(e) => handleLoadChange(e.target.value)}
                  placeholder="—"
                  disabled={log.isSkipped}
                  className="bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg px-3 py-1.5 w-24 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 disabled:opacity-40"
                />
                <span className="text-xs text-surface-500 dark:text-surface-400">
                  {log.loadUnit}
                </span>

                {/* Delta badge */}
                {delta !== null && delta !== 0 && (
                  <span
                    className={cn(
                      "text-xs font-semibold px-1.5 py-0.5 rounded",
                      delta > 0
                        ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10"
                        : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10"
                    )}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta % 1 === 0 ? delta : delta.toFixed(1)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          <button
            type="button"
            onClick={() => onNameClick(log.exerciseName)}
            title="View history"
            className="p-1.5 rounded-lg text-surface-400 hover:text-primary-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <History size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={toggleNotes}
            title="Add note"
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              showNotes
                ? "text-primary-500 bg-primary-50 dark:bg-primary-500/10"
                : "text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800"
            )}
          >
            <StickyNote size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={toggleSkip}
            title={log.isSkipped ? "Unskip" : "Skip"}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              log.isSkipped
                ? "text-orange-500 bg-orange-50 dark:bg-orange-500/10"
                : "text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800"
            )}
          >
            <SkipForward size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Notes textarea (expandable) */}
      {showNotes && (
        <div className="ml-8">
          <textarea
            rows={2}
            value={log.notes ?? ""}
            onChange={(e) => update({ notes: e.target.value || null })}
            placeholder="Add a note..."
            className="w-full bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 resize-none"
          />
        </div>
      )}
    </div>
  );
}
