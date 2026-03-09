"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components";

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface WeeklyVolume {
  week: string;
  sessions: number;
  throws: number;
}

interface ExerciseFrequency {
  exercise: string;
  count: number;
}

interface VolumeData {
  weeklyVolume: WeeklyVolume[];
  exerciseFrequency: ExerciseFrequency[];
  streaks: { current: number; longest: number };
}

/* ─── Volume Widget ────────────────────────────────────────────────────────── */

export function VolumeWidget() {
  const [data, setData] = useState<VolumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/athlete/training-volume")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) return <VolumeWidgetSkeleton />;

  if (error || !data) return null;

  const hasActivity =
    data.weeklyVolume.some((w) => w.sessions > 0 || w.throws > 0);

  if (!hasActivity) {
    return (
      <div className="card px-6 py-8">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
          Training Volume
        </h3>
        <div className="flex flex-col items-center text-center gap-2 py-4">
          <div className="w-11 h-11 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-surface-400 dark:text-surface-500"
              aria-hidden="true"
            >
              <path d="M3 3v18h18" />
              <path d="M7 16l4-8 4 4 4-6" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            No training data yet
          </p>
          <p className="text-xs text-muted max-w-[240px]">
            Start training to see your volume trends and session streaks.
          </p>
        </div>
      </div>
    );
  }

  // Show last 8 weeks for the bar chart
  const recentWeeks = data.weeklyVolume.slice(-8);
  const maxSessions = Math.max(...recentWeeks.map((w) => w.sessions), 1);

  // This week vs last week delta
  const thisWeek = data.weeklyVolume[data.weeklyVolume.length - 1];
  const lastWeek = data.weeklyVolume[data.weeklyVolume.length - 2];
  const throwsDelta = thisWeek && lastWeek ? thisWeek.throws - lastWeek.throws : 0;

  return (
    <div className="card px-6 py-5">
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
        Training Volume
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Mini bar chart — sessions per week */}
        <div className="sm:col-span-2">
          <p className="text-xs text-muted mb-3">Sessions per week</p>
          <div className="flex items-end gap-1.5 h-20">
            {recentWeeks.map((w, i) => {
              const height =
                maxSessions > 0
                  ? Math.max(4, (w.sessions / maxSessions) * 100)
                  : 4;
              const isCurrentWeek = i === recentWeeks.length - 1;
              return (
                <div
                  key={w.week}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <span
                    className={cn(
                      "text-[10px] tabular-nums font-medium",
                      isCurrentWeek
                        ? "text-primary-600 dark:text-primary-400"
                        : "text-muted"
                    )}
                  >
                    {w.sessions > 0 ? w.sessions : ""}
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-t-md transition-all duration-500",
                      isCurrentWeek
                        ? "bg-primary-500"
                        : "bg-surface-200 dark:bg-surface-700"
                    )}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[9px] text-muted truncate max-w-full">
                    {w.week.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats column */}
        <div className="flex flex-col gap-4">
          {/* Throws this week */}
          <div>
            <p className="text-xs text-muted">Throws this week</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-bold tabular-nums font-heading text-[var(--foreground)]">
                {thisWeek?.throws ?? 0}
              </span>
              {throwsDelta !== 0 && (
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    throwsDelta > 0
                      ? "text-success-600 dark:text-success-400"
                      : "text-danger-600 dark:text-danger-400"
                  )}
                >
                  {throwsDelta > 0 ? "+" : ""}
                  {throwsDelta}
                </span>
              )}
            </div>
          </div>

          {/* Current streak */}
          <div>
            <p className="text-xs text-muted">Current streak</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold tabular-nums font-heading text-primary-600 dark:text-primary-400">
                {data.streaks.current}
              </span>
              <span className="text-xs text-muted">
                day{data.streaks.current !== 1 ? "s" : ""}
              </span>
            </div>
            {data.streaks.longest > data.streaks.current && (
              <p className="text-[10px] text-muted mt-0.5">
                Best: {data.streaks.longest}d
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Exercise frequency — show top 4 */}
      {data.exerciseFrequency.length > 0 && (
        <div className="mt-5 pt-4 border-t border-[var(--card-border)]">
          <p className="text-xs text-muted mb-2">Top drills (all time)</p>
          <div className="flex flex-wrap gap-2">
            {data.exerciseFrequency.slice(0, 4).map((ex) => (
              <span
                key={ex.exercise}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-100 dark:bg-surface-800 text-[var(--foreground)]"
              >
                {ex.exercise}
                <span className="text-muted tabular-nums">{ex.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Loading Skeleton ─────────────────────────────────────────────────────── */

function VolumeWidgetSkeleton() {
  return (
    <div className="card px-6 py-5 space-y-4">
      <Skeleton className="h-4 w-32" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="sm:col-span-2 space-y-2">
          <Skeleton className="h-3 w-24" />
          <div className="flex items-end gap-1.5 h-20">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-t-md"
                style={{ height: `${20 + Math.random() * 60}%` }}
              />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-12" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
