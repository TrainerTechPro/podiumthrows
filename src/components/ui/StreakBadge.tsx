"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StreakBadgeProps {
  /** Number of consecutive training days */
  days: number;
  /** Whether the streak is active (trained today / yesterday) */
  isActive?: boolean;
  className?: string;
}

/**
 * Compact pill showing the user's current training streak.
 * Active streaks get an animated flame + glow.
 */
export function StreakBadge({ days, isActive = true, className }: StreakBadgeProps) {
  if (days < 1) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums transition-shadow duration-300",
        isActive
          ? "bg-primary-500/15 text-primary-600 dark:text-primary-400 shadow-glow animate-milestone-pop"
          : "bg-surface-100 dark:bg-surface-800 text-surface-500",
        className
      )}
    >
      <Flame
        size={14}
        strokeWidth={1.75}
        className={cn("shrink-0", isActive && "animate-streak-flame text-primary-500")}
        aria-hidden="true"
      />
      {days}-day streak
    </span>
  );
}
