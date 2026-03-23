"use client";

import { useMemo, useId } from "react";
import { cn } from "@/lib/utils";
import type { CalendarDay } from "@/lib/data/dashboard";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
}

function todayYMD(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Inline style for the dot scale-in spring animation.
 * Uses a CSS animation via the style prop to avoid dangerouslySetInnerHTML.
 */
function dotStyle(delayMs: number): React.CSSProperties {
  return {
    transform: "scale(0)",
    animation: `dotScaleIn 400ms ease-out ${delayMs}ms both`,
  };
}

export function WorkoutCalendarWidget({ days }: { days: CalendarDay[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = todayYMD();
  const scopeId = useId();

  const monthName = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const { firstDay, daysInMonth } = useMemo(
    () => getMonthGrid(year, month),
    [year, month]
  );

  // Build a lookup: "YYYY-MM-DD" -> CalendarDay
  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const d of days) {
      map.set(d.date, d);
    }
    return map;
  }, [days]);

  return (
    <div className="card px-4 py-4 sm:px-5">
      {/*
       * CSS keyframe for dot scale-in with spring overshoot.
       * This is a static string — no user content — injected via <style> tag.
       */}
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `@keyframes dotScaleIn{0%{transform:scale(0)}60%{transform:scale(1.3)}80%{transform:scale(0.9)}100%{transform:scale(1)}}`,
        }}
      />

      {/* Header */}
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
        Workout Calendar
      </h3>
      <p className="text-sm font-medium text-[var(--foreground)] text-center mb-3">
        {monthName}
      </p>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {DAY_LABELS.map((label, i) => (
          <div
            key={`${scopeId}-dh-${i}`}
            className="text-center text-[10px] font-medium text-muted uppercase"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-0">
        {/* Leading empty cells */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`${scopeId}-empty-${i}`} className="h-10" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
          const isToday = dateStr === today;
          const entry = dayMap.get(dateStr);
          const hasCompleted = entry?.hasCompleted ?? false;
          const hasScheduled = entry?.hasScheduled ?? false;

          return (
            <div
              key={dateStr}
              className="flex flex-col items-center justify-center h-10"
            >
              <span
                className={cn(
                  "text-xs tabular-nums leading-none w-6 h-6 flex items-center justify-center rounded-full",
                  isToday
                    ? "bg-primary-500 text-white font-bold"
                    : "text-[var(--foreground)]"
                )}
              >
                {dayNum}
              </span>

              {/* Indicator dots */}
              <div className="flex items-center gap-0.5 h-2 mt-0.5">
                {hasCompleted && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                    style={dotStyle(dayNum * 20)}
                    aria-label="Completed"
                  />
                )}
                {hasScheduled && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-primary-500"
                    style={dotStyle(dayNum * 20 + 50)}
                    aria-label="Scheduled"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 pt-2 border-t border-[var(--card-border)]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-muted">Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
          <span className="text-[10px] text-muted">Scheduled</span>
        </div>
      </div>
    </div>
  );
}
