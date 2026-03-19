"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface HistoryEntry {
  id: string;
  load: number | null;
  loadUnit: string;
  duration: number | null;
  sets: number | null;
  reps: number | null;
  createdAt: string;
  workoutLog: {
    weekNumber: number;
    workoutNumber: number;
    date: string;
  };
}

interface ExerciseHistoryDrawerProps {
  exerciseName: string | null;
  onClose: () => void;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function ExerciseHistoryDrawer({
  exerciseName,
  onClose,
}: ExerciseHistoryDrawerProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (name: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/lifting/exercises/history?name=${encodeURIComponent(name)}&limit=10`
      );
      if (!res.ok) throw new Error("Failed to load history");
      const json = await res.json();
      setEntries(json.data ?? []);
    } catch {
      setError("Could not load exercise history.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (exerciseName) {
      fetchHistory(exerciseName);
    } else {
      setEntries([]);
    }
  }, [exerciseName, fetchHistory]);

  /* Close on Escape */
  useEffect(() => {
    if (!exerciseName) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [exerciseName, onClose]);

  const isOpen = exerciseName !== null;

  /* Build load trend string */
  const loadTrend = entries
    .filter((e) => e.load != null)
    .reverse()
    .map((e) => `${e.load} ${e.loadUnit}`)
    .join(" \u2192 ");

  const durationTrend = entries
    .filter((e) => e.duration != null)
    .reverse()
    .map((e) => `${e.duration}s`)
    .join(" \u2192 ");

  const trend = loadTrend || durationTrend;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 w-80 bg-white dark:bg-surface-900",
          "shadow-xl border-l border-surface-200 dark:border-surface-700",
          "z-50 transform transition-transform duration-300 ease-out",
          "flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-surface-200 dark:border-surface-700 shrink-0">
          <h3 className="text-sm font-heading font-semibold text-surface-900 dark:text-surface-100 truncate">
            {exerciseName ?? "History"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 dark:hover:text-surface-200 transition-colors"
            aria-label="Close"
          >
            <X size={16} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2
                size={20}
                className="animate-spin text-primary-500"
                aria-hidden="true"
              />
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-danger-500 py-4">{error}</p>
          )}

          {!loading && !error && entries.length === 0 && (
            <p className="text-sm text-surface-400 dark:text-surface-500 py-4 text-center">
              No history found for this exercise.
            </p>
          )}

          {!loading && !error && entries.length > 0 && (
            <div className="space-y-4">
              {/* Trend line */}
              {trend && (
                <div className="bg-surface-50 dark:bg-surface-800/60 rounded-lg px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide font-medium text-surface-400 dark:text-surface-500 mb-1">
                    Progression
                  </p>
                  <p className="text-xs text-surface-700 dark:text-surface-300 leading-relaxed">
                    {trend}
                  </p>
                </div>
              )}

              {/* History entries */}
              <div className="space-y-1">
                {entries.map((entry) => {
                  const dateStr = entry.workoutLog.date
                    ? new Date(entry.workoutLog.date + "T12:00:00").toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" }
                      )
                    : "—";

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between py-2 px-1 border-b border-surface-100 dark:border-surface-800 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          Week {entry.workoutLog.weekNumber}, W
                          {entry.workoutLog.workoutNumber}
                        </p>
                        <p className="text-[10px] text-surface-400 dark:text-surface-500">
                          {dateStr}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {entry.load != null ? (
                          <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                            {entry.load} {entry.loadUnit}
                          </p>
                        ) : entry.duration != null ? (
                          <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                            {entry.duration}s
                          </p>
                        ) : (
                          <p className="text-sm text-surface-400">—</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
