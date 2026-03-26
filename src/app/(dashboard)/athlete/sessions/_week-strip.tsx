"use client";

import { cn } from "@/lib/utils";
import type { WeekDay } from "@/lib/data/training-hub";

const DOT_COLORS: Record<WeekDay["sessionType"], string> = {
  throws: "bg-amber-500",
  lift: "bg-blue-500",
  mixed: "bg-emerald-500",
  rest: "",
};

export function WeekStrip({ days }: { days: WeekDay[] }) {
  return (
    <div className="card p-3">
      <div className="flex gap-1">
        {days.map((day) => (
          <div
            key={day.date}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-colors",
              day.isToday
                ? "bg-primary-500/10 ring-1 ring-primary-500/30"
                : "bg-surface-50 dark:bg-surface-800/50"
            )}
          >
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide",
                day.isToday
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-muted"
              )}
            >
              {day.dayLabel}
            </span>
            <span
              className={cn(
                "text-sm font-bold tabular-nums",
                day.isToday
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-[var(--foreground)]"
              )}
            >
              {day.dayNum}
            </span>
            {day.sessionType !== "rest" && (
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  DOT_COLORS[day.sessionType]
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
