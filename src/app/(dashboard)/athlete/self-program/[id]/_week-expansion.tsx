"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { NumberFlow } from "@/components/ui/NumberFlow";
import { StaggeredList } from "@/components/ui/StaggeredList";

/* ─── Shared Types ───────────────────────────────────────────────── */

export interface ProgramSession {
  id: string;
  weekNumber: number;
  dayOfWeek: number;
  dayType: string;
  scheduledDate: string | null;
  sessionType: string;
  focusLabel: string;
  totalThrowsTarget: number;
  estimatedDuration: number | null;
  status: string;
  completedAt: string | null;
  actualThrows: number | null;
  bestMark: number | null;
  rpe: number | null;
}

export interface ProgramPhase {
  id: string;
  phase: string;
  phaseOrder: number;
  startWeek: number;
  endWeek: number;
  durationWeeks: number;
  throwsPerWeekTarget: number;
  strengthDaysTarget: number;
  cePercent: number;
  sdPercent: number;
  spPercent: number;
  gpPercent: number;
  status: string;
  sessions: ProgramSession[];
}

/* ─── Phase Colors ───────────────────────────────────────────────── */

export const PHASE_COLORS: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  ACCUMULATION: {
    bg: "bg-blue-50 dark:bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-500/30",
    dot: "bg-blue-500",
  },
  TRANSMUTATION: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-500/30",
    dot: "bg-amber-500",
  },
  REALIZATION: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  COMPETITION: {
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-200 dark:border-red-500/30",
    dot: "bg-red-500",
  },
};

export function getPhaseColor(phase: string) {
  return PHASE_COLORS[phase] ?? PHASE_COLORS.ACCUMULATION;
}

/* ─── Status Helpers ─────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PLANNED: { bg: "bg-surface-100 dark:bg-surface-800", text: "text-surface-600 dark:text-surface-400" },
  SCHEDULED: { bg: "bg-surface-100 dark:bg-surface-800", text: "text-surface-600 dark:text-surface-400" },
  IN_PROGRESS: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-300" },
  ACTIVE: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-300" },
  COMPLETED: { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300" },
  SKIPPED: { bg: "bg-surface-100 dark:bg-surface-800", text: "text-surface-500 dark:text-surface-500" },
};

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.PLANNED;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

const DAY_NAMES: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

function formatSessionType(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/* ─── Session Card ───────────────────────────────────────────────── */

export function SessionCard({
  session,
  configId,
}: {
  session: ProgramSession;
  configId: string;
}) {
  const statusStyle = getStatusStyle(session.status);
  const dayName = DAY_NAMES[session.dayOfWeek] ?? `Day ${session.dayOfWeek}`;

  return (
    <Link
      href={`/athlete/self-program/${configId}/session/${session.id}`}
      className="card card-interactive p-4 flex items-center gap-4"
    >
      {/* Day + type */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {dayName}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-surface-100 dark:bg-surface-800 text-muted uppercase">
            {formatSessionType(session.sessionType)}
          </span>
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold",
              statusStyle.bg,
              statusStyle.text,
            )}
          >
            {session.status}
          </span>
        </div>
        <p className="text-xs text-muted truncate">{session.focusLabel}</p>
        {session.scheduledDate && (
          <p className="text-[11px] text-muted flex items-center gap-1">
            <CalendarDays size={12} strokeWidth={1.75} aria-hidden="true" />
            {formatDate(session.scheduledDate)}
          </p>
        )}
      </div>

      {/* Throws target */}
      <div className="text-right shrink-0 space-y-0.5">
        <p className="text-lg font-bold font-heading text-[var(--foreground)] tabular-nums">
          <NumberFlow value={session.totalThrowsTarget} />
        </p>
        <p className="text-[10px] text-muted uppercase tracking-wider">throws</p>
      </div>

      {/* Duration */}
      {session.estimatedDuration != null && (
        <div className="hidden sm:flex items-center gap-1 text-xs text-muted shrink-0">
          <Clock size={12} strokeWidth={1.75} aria-hidden="true" />
          <span className="tabular-nums">{session.estimatedDuration}min</span>
        </div>
      )}

      {/* Chevron */}
      <ChevronRight
        size={16}
        strokeWidth={1.75}
        className="text-muted shrink-0"
        aria-hidden="true"
      />
    </Link>
  );
}

/* ─── Week Expansion ─────────────────────────────────────────────── */

export function WeekExpansion({
  weekNumber,
  phase,
  sessions,
  configId,
}: {
  weekNumber: number;
  phase: ProgramPhase;
  sessions: ProgramSession[];
  configId: string;
}) {
  const colors = getPhaseColor(phase.phase);

  return (
    <div className="space-y-3 animate-fade-slide-in">
      {/* Week header */}
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-bold text-[var(--foreground)]">
          Week {weekNumber}
        </h3>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold",
            colors.bg,
            colors.text,
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", colors.dot)} />
          {phase.phase}
        </span>
      </div>

      {/* Phase exercise distribution */}
      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        <span>
          CE{" "}
          <strong className={colors.text}>
            {Math.round(phase.cePercent)}%
          </strong>
        </span>
        <span>
          SDE{" "}
          <strong className={colors.text}>
            {Math.round(phase.sdPercent)}%
          </strong>
        </span>
        <span>
          SPE{" "}
          <strong className={colors.text}>
            {Math.round(phase.spPercent)}%
          </strong>
        </span>
        <span>
          GPE{" "}
          <strong className={colors.text}>
            {Math.round(phase.gpPercent)}%
          </strong>
        </span>
      </div>

      {/* Session cards */}
      <StaggeredList className="grid grid-cols-1 gap-2">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} configId={configId} />
        ))}
      </StaggeredList>

      {sessions.length === 0 && (
        <p className="text-sm text-muted text-center py-4">
          No sessions scheduled for this week.
        </p>
      )}
    </div>
  );
}
