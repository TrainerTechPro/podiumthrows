"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ProgrammedSessionWithDetails } from "@/lib/data/programming";
import { SessionCard } from "./_session-card";
import { cn } from "@/lib/utils";
import { Plus, Trophy } from "lucide-react";
import { pickPhaseForDay, type TaperPhase } from "@/lib/competition/taper-phase";

/* ─── Competition markers (public — page.tsx maps API response into this) ─ */

export interface CompetitionMarker {
  id: string;
  date: string; // YYYY-MM-DD
  meetName: string;
  priority: string; // "A" | "B" | "C"
  athleteId: string;
  athleteName: string;
  event: string;
}

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
  competitions?: CompetitionMarker[];
  weekStart: Date;
  onClickDay: (date: string) => void;
  onClickSession: (session: ProgrammedSessionWithDetails) => void;
  filterGroupId: string | null;
}

/* ─── Phase → day-column tint ─────────────────────────────────────────── */

const PHASE_TINT: Record<NonNullable<TaperPhase>, string> = {
  race: "bg-red-500/10 ring-1 ring-inset ring-red-500/20",
  peak: "bg-amber-500/10 ring-1 ring-inset ring-amber-500/20",
  taper: "bg-amber-500/5",
};

const PHASE_LABEL: Record<NonNullable<TaperPhase>, string> = {
  race: "Race Day",
  peak: "Peak",
  taper: "Taper",
};

export function WeekCalendar({
  sessions,
  competitions = [],
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

  /* ── Group competitions by day (markers on race day) ──────────────── */
  const compsByDay = useMemo(() => {
    const map = new Map<string, CompetitionMarker[]>();
    for (const day of days) map.set(day.dateStr, []);
    for (const c of competitions) {
      const bucket = map.get(c.date);
      if (bucket) bucket.push(c);
    }
    return map;
  }, [days, competitions]);

  /* ── All upcoming competition dates in view (for phase tinting) ──── */
  const upcomingDates = useMemo(() => competitions.map((c) => c.date), [competitions]);

  return (
    <div className="overflow-x-auto custom-scrollbar -mx-1 px-1">
      <div className="grid grid-cols-7 gap-2 min-w-[980px] md:min-w-0">
        {days.map((day) => {
          const daySessions = sessionsByDay.get(day.dateStr) ?? [];
          const dayComps = compsByDay.get(day.dateStr) ?? [];
          const phase = pickPhaseForDay(day.dateStr, upcomingDates);
          const visibleComps = dayComps.slice(0, 2);
          const hiddenCompCount = dayComps.length - visibleComps.length;

          return (
            <div
              key={day.dateStr}
              className={cn(
                "flex flex-col rounded-xl border border-[var(--card-border)] min-h-[160px]",
                day.isToday && "bg-primary-500/5",
                // Phase tint sits underneath "today" tint; today keeps the primary accent
                !day.isToday && phase && PHASE_TINT[phase]
              )}
            >
              {/* Phase label strip (taper / peak / race day) */}
              {phase && (
                <div
                  className={cn(
                    "px-2.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider",
                    phase === "race"
                      ? "text-red-600 dark:text-red-400"
                      : "text-amber-700 dark:text-amber-400"
                  )}
                >
                  {PHASE_LABEL[phase]}
                </div>
              )}

              {/* Competition markers — up to 2 chips, "+N more" link if overflow */}
              {dayComps.length > 0 && (
                <div className="px-1.5 pt-1.5 space-y-1">
                  {visibleComps.map((c) => (
                    <Link
                      key={c.id}
                      href={`/coach/competitions?meet=${encodeURIComponent(c.meetName)}&date=${c.date}`}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium",
                        "border border-red-500/20 bg-red-500/10",
                        "text-red-700 dark:text-red-300",
                        "hover:border-red-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40",
                        "transition-colors"
                      )}
                      aria-label={`${c.athleteName} — ${c.meetName} (${c.priority}-Meet)`}
                    >
                      <Trophy size={10} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                      <span className="truncate">{c.athleteName}</span>
                      <span className="shrink-0 opacity-70">· {c.priority}</span>
                    </Link>
                  ))}
                  {hiddenCompCount > 0 && (
                    <Link
                      href={`/coach/competitions?date=${day.dateStr}`}
                      className="block text-[10px] text-muted hover:text-primary-500 px-2 py-0.5"
                    >
                      + {hiddenCompCount} more
                    </Link>
                  )}
                </div>
              )}

              {/* Day header */}
              <time
                dateTime={day.dateStr}
                className={cn(
                  "block px-2.5 py-2 text-xs font-semibold uppercase tracking-wider border-b border-[var(--card-border)]",
                  day.isToday ? "text-primary-600 dark:text-primary-400" : "text-muted"
                )}
              >
                {day.dayLabel}
              </time>

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
