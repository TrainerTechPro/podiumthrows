"use client";

import { useMemo } from "react";
import type { ProgrammedSessionWithDetails } from "@/lib/data/programming";
import { SessionCard } from "./_session-card";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

/* ─── Helpers ─────────────────────────────────────────────────────────── */

interface WeekDay {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "Mon 17"
  isToday: boolean;
}

function getWeekDays(weekStart: Date): WeekDay[] {
  const today = new Date();
  const todayStr = formatDateStr(today);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dateStr = formatDateStr(d);
    const short = d.toLocaleDateString("en-US", { weekday: "short" });
    return {
      date: d,
      dateStr,
      dayLabel: `${short} ${d.getDate()}`,
      isToday: dateStr === todayStr,
    };
  });
}

function formatDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ─── Component ───────────────────────────────────────────────────────── */

interface WeekCalendarProps {
  sessions: ProgrammedSessionWithDetails[];
  weekStart: Date;
  onClickDay: (date: string) => void;
  onClickSession: (session: ProgrammedSessionWithDetails) => void;
  filterGroupId: string | null;
}

export function WeekCalendar({
  sessions,
  weekStart,
  onClickDay,
  onClickSession,
  filterGroupId,
}: WeekCalendarProps) {
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);

  /* ── Filter sessions by active group tab ───────────────────────────── */
  const filtered = useMemo(() => {
    if (filterGroupId === null) return sessions;

    if (filterGroupId === "unassigned") {
      return sessions.filter((s) => s.tier === "INDIVIDUAL");
    }

    // Show sessions belonging to this group, OR TEAM-level sessions that
    // don't have a GROUP-level override for this specific group
    return sessions.filter((s) => {
      // Direct match: session is for this group
      if (s.group?.id === filterGroupId) return true;

      // TEAM sessions without a group override for this group
      if (s.tier === "TEAM") {
        const hasGroupOverride = sessions.some(
          (o) => o.parentId === s.id && o.group?.id === filterGroupId
        );
        // Show the TEAM session; the override will also show
        return !hasGroupOverride;
      }

      return false;
    });
  }, [sessions, filterGroupId]);

  /* ── Group sessions by day ─────────────────────────────────────────── */
  const sessionsByDay = useMemo(() => {
    const map = new Map<string, ProgrammedSessionWithDetails[]>();
    for (const day of days) {
      map.set(day.dateStr, []);
    }
    for (const s of filtered) {
      const bucket = map.get(s.scheduledDate);
      if (bucket) bucket.push(s);
    }
    return map;
  }, [days, filtered]);

  return (
    <div className="overflow-x-auto custom-scrollbar -mx-1 px-1">
      <div className="grid grid-cols-7 gap-2 min-w-[980px] md:min-w-0">
        {days.map((day) => {
          const daySessions = sessionsByDay.get(day.dateStr) ?? [];
          return (
            <div
              key={day.dateStr}
              className={cn(
                "flex flex-col rounded-xl border border-[var(--card-border)] min-h-[160px]",
                day.isToday && "bg-primary-500/5"
              )}
            >
              {/* Day header */}
              <div
                className={cn(
                  "px-2.5 py-2 text-xs font-semibold uppercase tracking-wider border-b border-[var(--card-border)]",
                  day.isToday ? "text-primary-600 dark:text-primary-400" : "text-muted"
                )}
              >
                {day.dayLabel}
              </div>

              {/* Session list */}
              <div className="flex-1 p-1.5 space-y-1.5">
                {daySessions.map((s) => (
                  <SessionCard key={s.id} session={s} onClick={() => onClickSession(s)} />
                ))}

                {/* Empty state — add button */}
                {daySessions.length === 0 && (
                  <button
                    type="button"
                    onClick={() => onClickDay(day.dateStr)}
                    className={cn(
                      "w-full h-full min-h-[80px] flex items-center justify-center",
                      "rounded-lg border-2 border-dashed border-surface-200 dark:border-surface-700",
                      "text-muted hover:text-primary-500 hover:border-primary-500/40",
                      "transition-colors cursor-pointer",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                    )}
                    aria-label={`Add session on ${day.dayLabel}`}
                  >
                    <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Add button when sessions exist */}
              {daySessions.length > 0 && (
                <button
                  type="button"
                  onClick={() => onClickDay(day.dateStr)}
                  className={cn(
                    "mx-1.5 mb-1.5 flex items-center justify-center gap-1 py-1.5",
                    "rounded-lg border border-dashed border-surface-200 dark:border-surface-700",
                    "text-xs text-muted hover:text-primary-500 hover:border-primary-500/40",
                    "transition-colors cursor-pointer",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                  )}
                  aria-label={`Add another session on ${day.dayLabel}`}
                >
                  <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
                  Add
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
