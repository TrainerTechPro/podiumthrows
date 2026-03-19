"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Minus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";

/* ─── Types (serialized from server) ────────────────────────────────────── */

interface WorkoutLog {
  id: string;
  weekNumber: number;
  workoutNumber: number;
  status: string;
  actualRpe: number | null;
  date: string;
}

interface Phase {
  id: string;
  name: string;
  method: string;
  startWeek: number;
  endWeek: number;
  order: number;
}

interface Program {
  id: string;
  workoutsPerWeek: number;
  totalWeeks: number;
  phases: Phase[];
  workoutLogs: WorkoutLog[];
}

/* ─── RPE Color Map ─────────────────────────────────────────────────────── */

const RPE_COLORS: Record<
  number,
  { border: string; bg: string; text: string }
> = {
  1: {
    border: "border-l-green-500",
    bg: "bg-green-500/10",
    text: "text-green-600 dark:text-green-400",
  },
  2: {
    border: "border-l-yellow-500",
    bg: "bg-yellow-500/10",
    text: "text-yellow-600 dark:text-yellow-400",
  },
  3: {
    border: "border-l-orange-500",
    bg: "bg-orange-500/10",
    text: "text-orange-600 dark:text-orange-400",
  },
  4: {
    border: "border-l-red-500",
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
  },
};

function getColors(workoutNumber: number) {
  return (
    RPE_COLORS[workoutNumber] ??
    RPE_COLORS[4]
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function WeekGrid({ program }: { program: Program }) {
  const router = useRouter();
  const [creatingSlot, setCreatingSlot] = useState<string | null>(null);

  // Index workout logs by "week-workout" for O(1) lookup
  const logIndex = new Map<string, WorkoutLog>();
  for (const log of program.workoutLogs) {
    logIndex.set(`${log.weekNumber}-${log.workoutNumber}`, log);
  }

  async function handleCellClick(weekNumber: number, workoutNumber: number) {
    const key = `${weekNumber}-${workoutNumber}`;
    const existingLog = logIndex.get(key);

    if (existingLog) {
      router.push(`/coach/my-lifting/workout/${existingLog.id}`);
      return;
    }

    // Create a new workout log
    setCreatingSlot(key);
    try {
      const res = await fetch("/api/lifting/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          programId: program.id,
          weekNumber,
          workoutNumber,
          date: todayString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // If 409 conflict, the workout was already created — try to find it
        if (res.status === 409) {
          router.refresh();
          return;
        }
        console.error("Failed to create workout:", data.error);
        return;
      }

      const newLog = await res.json();
      router.push(`/coach/my-lifting/workout/${newLog.id}`);
    } catch (err) {
      console.error("Failed to create workout:", err);
    } finally {
      setCreatingSlot(null);
    }
  }

  // Group weeks by phase
  const phaseGroups: {
    phase: Phase;
    weeks: number[];
  }[] = [];

  for (const phase of program.phases) {
    const weeks: number[] = [];
    for (let w = phase.startWeek; w <= phase.endWeek; w++) {
      weeks.push(w);
    }
    phaseGroups.push({ phase, weeks });
  }

  return (
    <div className="space-y-6">
      {phaseGroups.map(({ phase, weeks }) => (
        <div key={phase.id}>
          {/* Phase Divider */}
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-sm font-heading font-semibold text-surface-900 dark:text-surface-100 whitespace-nowrap">
              {phase.name}
            </h3>
            <p className="text-xs text-surface-400 dark:text-surface-500 truncate">
              {phase.method}
            </p>
            <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
          </div>

          {/* Weeks */}
          <div className="space-y-2">
            {weeks.map((weekNum) => (
              <div key={weekNum} className="flex items-center gap-3">
                {/* Week Label */}
                <span className="text-xs font-medium text-surface-500 dark:text-surface-400 w-14 shrink-0">
                  Week {weekNum}
                </span>

                {/* Workout Cells */}
                <div className="flex-1 grid grid-cols-4 gap-2">
                  {Array.from(
                    { length: program.workoutsPerWeek },
                    (_, i) => i + 1
                  ).map((workoutNum) => {
                    const key = `${weekNum}-${workoutNum}`;
                    const log = logIndex.get(key);
                    const colors = getColors(workoutNum);
                    const isCreating = creatingSlot === key;

                    const status = log?.status ?? "NOT_STARTED";

                    return (
                      <button
                        key={key}
                        onClick={() => handleCellClick(weekNum, workoutNum)}
                        disabled={isCreating}
                        className={cn(
                          "relative flex items-center gap-2 px-3 py-2.5 rounded-lg border-l-4 transition-all duration-150",
                          "hover:shadow-sm active:scale-[0.98]",
                          "focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:ring-offset-1 focus:ring-offset-[var(--background)]",
                          "disabled:opacity-60 disabled:cursor-wait",
                          colors.border,
                          status === "COMPLETED"
                            ? "bg-green-500/5 dark:bg-green-500/10 border border-l-4 border-green-200 dark:border-green-800/40"
                            : status === "IN_PROGRESS"
                              ? "bg-primary-500/5 dark:bg-primary-500/10 border border-l-4 border-primary-200 dark:border-primary-800/40"
                              : "bg-white dark:bg-surface-800/60 border border-l-4 border-surface-200 dark:border-surface-700"
                        )}
                      >
                        {/* Status Icon */}
                        <div className="shrink-0">
                          {isCreating ? (
                            <Loader2
                              size={16}
                              className="animate-spin text-primary-500"
                              aria-hidden="true"
                            />
                          ) : status === "COMPLETED" ? (
                            <Check
                              size={16}
                              className="text-green-500"
                              strokeWidth={2.5}
                              aria-hidden="true"
                            />
                          ) : status === "IN_PROGRESS" ? (
                            <div
                              className="w-2.5 h-2.5 rounded-full bg-primary-500"
                              aria-hidden="true"
                            />
                          ) : status === "SKIPPED" ? (
                            <Minus
                              size={16}
                              className="text-surface-400 dark:text-surface-500"
                              aria-hidden="true"
                            />
                          ) : (
                            <Circle
                              size={16}
                              className="text-surface-300 dark:text-surface-600"
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
                          )}
                        </div>

                        {/* Label */}
                        <div className="min-w-0 text-left">
                          <p
                            className={cn(
                              "text-xs font-medium",
                              status === "COMPLETED"
                                ? "text-green-700 dark:text-green-400"
                                : status === "IN_PROGRESS"
                                  ? "text-primary-600 dark:text-primary-400"
                                  : "text-surface-600 dark:text-surface-300"
                            )}
                          >
                            W{workoutNum}
                          </p>

                          {/* Completed details */}
                          {status === "COMPLETED" && log && (
                            <p className="text-[10px] text-surface-500 dark:text-surface-400 truncate">
                              {log.actualRpe != null && `RPE ${log.actualRpe}`}
                              {log.actualRpe != null && log.date && " \u00B7 "}
                              {log.date && formatShortDate(log.date)}
                            </p>
                          )}

                          {/* In-progress indicator */}
                          {status === "IN_PROGRESS" && (
                            <p className="text-[10px] text-primary-500 dark:text-primary-400">
                              In progress
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
