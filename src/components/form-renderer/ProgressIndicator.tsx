"use client";

import type { FormDisplayMode } from "@/lib/forms/types";

interface ProgressIndicatorProps {
  mode: FormDisplayMode;
  currentIndex: number;
  totalCount: number;
  answeredCount: number;
  requiredCount: number;
}

export function ProgressIndicator({
  mode,
  currentIndex,
  totalCount,
  answeredCount,
  requiredCount,
}: ProgressIndicatorProps) {
  if (totalCount === 0) return null;

  // One-per-page: dot indicators
  if (mode === "ONE_PER_PAGE") {
    return (
      <div className="flex items-center justify-center gap-1.5 py-3">
        {Array.from({ length: totalCount }, (_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i === currentIndex
                ? "w-6 h-2 bg-primary-500"
                : i < currentIndex
                ? "w-2 h-2 bg-primary-500/50"
                : "w-2 h-2 bg-[var(--card-border)]"
            }`}
          />
        ))}
      </div>
    );
  }

  // All-at-once / sectioned: progress bar
  const pct =
    requiredCount > 0 ? Math.round((answeredCount / requiredCount) * 100) : 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {answeredCount} of {requiredCount} required
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--card-border)] overflow-hidden">
        <div
          className="h-full rounded-full bg-primary-500 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
