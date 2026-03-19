"use client";

import { Badge } from "@/components";
import { formatImplementWeight } from "@/lib/throws";

/* ─── Types ───────────────────────────────────────────────────────────────── */

export type SessionSummary = {
  totalExercises: number;
  prescribedCount: number;
  completionPercent: number;
  totalVolume: number;
  throwCount: number;
  bestThrow: {
    distance: number;
    event: string;
    implementWeight: number;
  } | null;
  prCount: number;
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${kg}kg`;
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function CompletionSummary({
  summary,
  rpe,
}: {
  summary: SessionSummary;
  rpe: number | null;
}) {
  return (
    <div className="card overflow-hidden animate-[fadeIn_300ms_ease]">
      {/* Header */}
      <div className="px-5 py-4 bg-emerald-500/10 border-b border-emerald-500/20">
        <div className="flex items-center gap-2">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-emerald-500"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <h3 className="font-bold text-emerald-700 dark:text-emerald-400">
            Session Complete
          </h3>
        </div>
      </div>

      {/* Stats grid */}
      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {/* Exercises completed */}
        <div>
          <p className="text-xs text-muted uppercase tracking-wide mb-0.5">
            Exercises
          </p>
          <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
            {summary.totalExercises}
            {summary.prescribedCount > 0 && (
              <span className="text-sm font-normal text-muted">
                {" "}
                / {summary.prescribedCount}
              </span>
            )}
          </p>
          {summary.prescribedCount > 0 && (
            <p className="text-xs text-muted">
              {summary.completionPercent}% completion
            </p>
          )}
        </div>

        {/* Total volume */}
        {summary.totalVolume > 0 && (
          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-0.5">
              Total Volume
            </p>
            <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
              {formatVolume(summary.totalVolume)}
            </p>
          </div>
        )}

        {/* Session RPE */}
        {rpe != null && (
          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-0.5">
              Session RPE
            </p>
            <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
              {rpe.toFixed(1)}
              <span className="text-sm font-normal text-muted"> / 10</span>
            </p>
          </div>
        )}

        {/* Throws */}
        {summary.throwCount > 0 && (
          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-0.5">
              Throws
            </p>
            <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
              {summary.throwCount}
            </p>
          </div>
        )}

        {/* Best throw */}
        {summary.bestThrow && (
          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-0.5">
              Best Throw
            </p>
            <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
              {summary.bestThrow.distance.toFixed(2)}m
            </p>
            <p className="text-xs text-muted">
              {formatEventName(summary.bestThrow.event)} ({formatImplementWeight(summary.bestThrow.implementWeight)})
            </p>
          </div>
        )}

        {/* PRs */}
        {summary.prCount > 0 && (
          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-0.5">
              Personal Records
            </p>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {summary.prCount}
              </p>
              <Badge variant="warning">PR</Badge>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
