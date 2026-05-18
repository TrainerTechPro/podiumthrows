"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BarChart3 } from "lucide-react";
import type { WeeklyVolume } from "@/lib/data/dashboard-intel";

export function VolumeChart({ data }: { data: WeeklyVolume }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxThrows = Math.max(...data.days.map((d) => d.throws), 1);

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary-500" strokeWidth={1.75} aria-hidden="true" />
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
          Weekly Volume
          <span className="ml-1.5 text-surface-400 font-normal normal-case">throws</span>
        </h3>
      </div>

      <div className="flex items-end gap-2 h-[160px] overflow-x-auto custom-scrollbar min-w-0">
        {data.days.map((day, i) => {
          const pct = maxThrows > 0 ? (day.throws / maxThrows) * 100 : 0;
          const isToday = i === data.todayIndex;
          const isHovered = hoveredIdx === i;

          return (
            <div
              key={day.label}
              className="flex-1 flex flex-col items-center gap-1.5 min-w-[36px]"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Hover tooltip */}
              <div
                className={cn(
                  "text-nano font-medium px-1.5 py-0.5 rounded whitespace-nowrap transition-opacity",
                  "bg-surface-800 text-surface-100 dark:bg-surface-200 dark:text-surface-900",
                  isHovered && day.throws > 0 ? "opacity-100" : "opacity-0"
                )}
              >
                {day.throws} throws
              </div>

              {/* Bar container */}
              <div className="w-full flex items-end justify-center flex-1">
                <div
                  className={cn(
                    "w-full max-w-[28px] rounded-t transition-colors duration-300",
                    day.throws > 0
                      ? "bg-primary-500 dark:bg-primary-400"
                      : "bg-surface-200 dark:bg-surface-700",
                    isToday && day.throws > 0 && "ring-2 ring-primary-500/30",
                    isHovered && day.throws > 0 && "brightness-110"
                  )}
                  style={{
                    height: day.throws > 0 ? `${Math.max(pct, 8)}%` : "2px",
                  }}
                />
              </div>

              {/* Throw count */}
              <span className="text-xs tabular-nums font-medium text-[var(--foreground)]">
                {day.throws}
              </span>

              {/* Day label */}
              <span
                className={cn(
                  "text-nano uppercase tracking-wider",
                  isToday ? "text-primary-500 font-semibold" : "text-muted"
                )}
              >
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
