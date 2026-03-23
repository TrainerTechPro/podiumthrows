"use client";

import Link from "next/link";
import {
  Coffee,
  Target,
  Dumbbell,
  Flame,
  StickyNote,
  Snowflake,
  ChevronRight,
  Play,
} from "lucide-react";
import { Badge, Button, StaggeredList } from "@/components";
import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";
import type { TodaySession, TimelineItem } from "@/lib/data/dashboard";
import type { BadgeVariant } from "@/components/ui/Badge";

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  HELPERS                                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/** Map session status to Badge variant */
function statusBadgeVariant(status: string): BadgeVariant {
  const s = status.toUpperCase();
  if (s === "COMPLETED") return "success";
  if (s === "IN_PROGRESS") return "warning";
  if (s === "SCHEDULED") return "info";
  return "neutral"; // PLANNED, etc.
}

/** Human-readable status label */
function statusLabel(status: string): string {
  const s = status.toUpperCase();
  if (s === "IN_PROGRESS") return "In Progress";
  if (s === "COMPLETED") return "Completed";
  if (s === "SCHEDULED") return "Scheduled";
  return "Planned";
}

/** Color classes for timeline dot by exercise type */
function dotClasses(type: TimelineItem["type"]): string {
  switch (type) {
    case "throw":
      return "bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400";
    case "lift":
      return "bg-blue-500/15 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400";
    case "warmup":
      return "bg-orange-500/15 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400";
    case "cooldown":
      return "bg-sky-500/15 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400";
    case "note":
      return "bg-surface-200 dark:bg-surface-700 text-surface-500 dark:text-surface-400";
    default:
      return "bg-surface-200 dark:bg-surface-700 text-surface-500";
  }
}

/** Icon for each exercise type */
function DotIcon({ type }: { type: TimelineItem["type"] }) {
  const size = 14;
  const stroke = 1.75;
  switch (type) {
    case "throw":
      return <Target size={size} strokeWidth={stroke} aria-hidden="true" />;
    case "lift":
      return <Dumbbell size={size} strokeWidth={stroke} aria-hidden="true" />;
    case "warmup":
      return <Flame size={size} strokeWidth={stroke} aria-hidden="true" />;
    case "cooldown":
      return <Snowflake size={size} strokeWidth={stroke} aria-hidden="true" />;
    case "note":
      return <StickyNote size={size} strokeWidth={stroke} aria-hidden="true" />;
    default:
      return <Target size={size} strokeWidth={stroke} aria-hidden="true" />;
  }
}

/** Superset group badge (A / B / C) */
const SUPERSET_COLORS: Record<string, string> = {
  A: "bg-emerald-500 text-white",
  B: "bg-blue-500 text-white",
  C: "bg-pink-500 text-white",
};

function SupersetBadge({ group }: { group: string }) {
  const color = SUPERSET_COLORS[group] ?? "bg-surface-500 text-white";
  return (
    <span
      className={cn(
        "shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold leading-none",
        color,
      )}
      title={`Superset ${group}`}
    >
      {group}
    </span>
  );
}

/** Icon for session type (used in tabs) */
function SessionTypeIcon({ sessionType }: { sessionType: TodaySession["sessionType"] }) {
  const size = 15;
  const stroke = 1.75;
  switch (sessionType) {
    case "throws":
      return <Target size={size} strokeWidth={stroke} aria-hidden="true" />;
    case "lift":
      return <Dumbbell size={size} strokeWidth={stroke} aria-hidden="true" />;
    case "mixed":
      return <Flame size={size} strokeWidth={stroke} aria-hidden="true" />;
    default:
      return <Target size={size} strokeWidth={stroke} aria-hidden="true" />;
  }
}

/** Tab-friendly short label */
function sessionTabLabel(session: TodaySession): string {
  switch (session.sessionType) {
    case "throws":
      return "Throws";
    case "lift":
      return "Strength";
    case "mixed":
      return "Mixed";
    default:
      return "Session";
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  TIMELINE                                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

function SessionTimeline({
  items,
  totalItemCount,
}: {
  items: TimelineItem[];
  totalItemCount: number;
}) {
  const remaining = totalItemCount - items.length;

  return (
    <div className="relative pl-8">
      {/* Vertical line */}
      {items.length > 1 && (
        <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-surface-200 dark:bg-surface-700 rounded-full" />
      )}

      <StaggeredList className="space-y-0" staggerDelay={60} duration={200}>
        {items.map((item) => (
          <div key={item.id} className="relative flex items-center gap-3 py-2.5">
            {/* Dot */}
            <div
              className={cn(
                "absolute left-[-32px] w-6 h-6 rounded-lg flex items-center justify-center",
                dotClasses(item.type),
              )}
            >
              <DotIcon type={item.type} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                {item.name}
              </p>
              {item.detail && (
                <p className="text-xs text-muted truncate">{item.detail}</p>
              )}
            </div>

            {/* Superset badge */}
            {item.supersetGroup && <SupersetBadge group={item.supersetGroup} />}
          </div>
        ))}
      </StaggeredList>

      {remaining > 0 && (
        <p className="text-xs text-muted pl-1 pt-1 pb-1">
          + {remaining} more exercise{remaining !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  SESSION CONTENT (timeline + start button)                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

function SessionContent({ session }: { session: TodaySession }) {
  const isCompleted = session.status.toUpperCase() === "COMPLETED";
  const isInProgress = session.status.toUpperCase() === "IN_PROGRESS";

  return (
    <div className="space-y-4">
      <SessionTimeline
        items={session.items}
        totalItemCount={session.totalItemCount}
      />

      <Link href={session.href} className="block">
        <Button
          variant="primary"
          className="w-full"
          leftIcon={
            !isCompleted ? (
              <Play size={16} strokeWidth={1.75} aria-hidden="true" />
            ) : undefined
          }
        >
          {isCompleted
            ? "View Results"
            : isInProgress
              ? "Continue Workout"
              : "Start Workout"}
        </Button>
      </Link>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  EMPTY STATE                                                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

function RestDayState() {
  return (
    <div className="card shadow-sm md:hover:shadow-md md:transition-shadow">
      <div className="flex flex-col items-center text-center py-10 px-6 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
          <Coffee
            size={24}
            strokeWidth={1.75}
            className="text-surface-400 dark:text-surface-500"
            aria-hidden="true"
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Rest Day
          </h3>
          <p className="text-xs text-muted mt-1 max-w-[240px] leading-relaxed">
            No training scheduled today — enjoy your rest day. Recovery is where
            gains are made.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  SINGLE SESSION STATE                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

function SingleSessionView({ session }: { session: TodaySession }) {
  return (
    <div className="card p-5 space-y-4 shadow-sm md:hover:shadow-md md:transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Today&apos;s Workout
        </h3>
        <Link
          href={session.href}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary-500 hover:underline"
        >
          Full view
          <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      </div>

      {/* Session info row */}
      <div className="flex items-center gap-3">
        <h4 className="text-base font-semibold text-[var(--foreground)] truncate flex-1">
          {session.name}
        </h4>
        <Badge variant={statusBadgeVariant(session.status)} dot>
          {statusLabel(session.status)}
        </Badge>
      </div>

      {/* Timeline + button */}
      <SessionContent session={session} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MULTI-SESSION STATE (TABS)                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

function MultiSessionView({ sessions }: { sessions: TodaySession[] }) {
  return (
    <div className="card p-5 space-y-4 shadow-sm md:hover:shadow-md md:transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Today&apos;s Workouts
        </h3>
        <span className="text-xs text-muted tabular-nums">
          {sessions.length} sessions
        </span>
      </div>

      {/* Tabbed sessions */}
      <Tabs defaultTab={sessions[0].id}>
        <TabList variant="underline" className="-mx-1">
          {sessions.map((session) => (
            <TabTrigger
              key={session.id}
              id={session.id}
              variant="underline"
              icon={<SessionTypeIcon sessionType={session.sessionType} />}
            >
              {sessionTabLabel(session)}
            </TabTrigger>
          ))}
        </TabList>

        {sessions.map((session) => (
          <TabPanel key={session.id} id={session.id} className="pt-4">
            {/* Session name + status */}
            <div className="flex items-center gap-3 mb-4">
              <h4 className="text-sm font-semibold text-[var(--foreground)] truncate flex-1">
                {session.name}
              </h4>
              <Badge variant={statusBadgeVariant(session.status)} dot>
                {statusLabel(session.status)}
              </Badge>
            </div>

            {/* Timeline + button */}
            <SessionContent session={session} />
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MAIN EXPORT                                                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function TodayWorkoutWidget({ data }: { data: TodaySession[] }) {
  // State 1: No sessions
  if (!data || data.length === 0) {
    return <RestDayState />;
  }

  // State 2: Single session
  if (data.length === 1) {
    return <SingleSessionView session={data[0]} />;
  }

  // State 3: Multiple sessions
  return <MultiSessionView sessions={data} />;
}
