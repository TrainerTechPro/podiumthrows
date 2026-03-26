"use client";

import Link from "next/link";
import {
  PenLine,
  Heart,
  Video,
  Calendar,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Badge, Button, StaggeredList } from "@/components";
import { TodayWorkoutWidget } from "../dashboard/_widgets/today-workout";
import { WeekStrip } from "./_week-strip";
import { RequestProgramming } from "./_request-programming";
import { WeekRecapCard } from "./_week-recap";
import { OnboardingChecklist } from "./_onboarding-checklist";
import { cn } from "@/lib/utils";
import type { TrainingHubData } from "@/lib/data/training-hub";

/* ─── Quick Action Pills ─────────────────────────────────────────────────── */

function QuickActions({
  readinessCheckedIn,
  pendingQuestionnaires,
}: {
  readinessCheckedIn: boolean;
  pendingQuestionnaires: number;
}) {
  const actions = [
    { label: "Log Session", href: "/athlete/log-session", icon: PenLine },
    ...(!readinessCheckedIn
      ? [{ label: "Check-in", href: "/athlete/wellness", icon: Heart }]
      : []),
    { label: "Drill Videos", href: "/athlete/drill-videos", icon: Video },
    ...(pendingQuestionnaires > 0
      ? [{ label: `Questionnaires (${pendingQuestionnaires})`, href: "/athlete/questionnaires", icon: Calendar }]
      : []),
  ];

  return (
    <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-100 dark:bg-surface-800 text-xs font-medium text-[var(--foreground)] hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors whitespace-nowrap shrink-0"
        >
          <a.icon size={13} strokeWidth={1.75} aria-hidden="true" />
          {a.label}
        </Link>
      ))}
    </div>
  );
}

/* ─── Next Session Countdown ─────────────────────────────────────────────── */

function NextSessionCard({
  date,
  name,
  daysUntil,
}: {
  date: string;
  name: string;
  daysUntil: number;
}) {
  const formatted = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex flex-col items-center justify-center shrink-0">
        <span className="text-lg font-bold tabular-nums text-primary-500 leading-none">
          {daysUntil}
        </span>
        <span className="text-[9px] font-semibold text-primary-500/70 uppercase">
          {daysUntil === 1 ? "day" : "days"}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted">Next Session</p>
        <p className="text-sm font-semibold text-[var(--foreground)] truncate">
          {name}
        </p>
        <p className="text-xs text-muted">{formatted}</p>
      </div>
      <ChevronRight size={16} strokeWidth={1.75} className="text-muted shrink-0" aria-hidden="true" />
    </div>
  );
}

/* ─── Recent Completions ─────────────────────────────────────────────────── */

function RecentCompletions({
  sessions,
}: {
  sessions: TrainingHubData["recentCompletions"];
}) {
  const [expanded, setExpanded] = useState(false);
  // Show expanded by default on desktop via CSS, collapsed on mobile
  if (sessions.length === 0) return null;

  return (
    <section className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left sm:pointer-events-none"
      >
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Recent Sessions
        </h2>
        <span className="sm:hidden text-muted">
          {expanded ? (
            <ChevronUp size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
          )}
        </span>
      </button>

      <div className={cn("card divide-y divide-[var(--card-border)] overflow-hidden", !expanded && "hidden sm:block")}>
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                {s.name}
              </p>
              <p className="text-xs text-muted">
                {new Date(s.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {s.rpe != null && ` · RPE ${s.rpe.toFixed(1)}`}
                {s.throwCount != null && s.throwCount > 0 && ` · ${s.throwCount} throws`}
              </p>
            </div>
            <Badge variant="success">Done</Badge>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ─── Main Training Hub ──────────────────────────────────────────────────── */

export function TrainingHub({ data }: { data: TrainingHubData }) {
  if (data.state === "active") {
    return (
      <div className="space-y-5">
        {/* Today's sessions hero */}
        {data.todaySessions.length > 0 ? (
          <TodayWorkoutWidget data={data.todaySessions} />
        ) : data.nextSession ? (
          <NextSessionCard
            date={data.nextSession.date}
            name={data.nextSession.name}
            daysUntil={data.nextSession.daysUntil}
          />
        ) : null}

        {/* Week strip */}
        <WeekStrip days={data.weekDays} />

        {/* Quick actions */}
        <QuickActions
          readinessCheckedIn={data.readinessCheckedInToday}
          pendingQuestionnaires={data.pendingQuestionnaires}
        />

        {/* Recent completions */}
        <RecentCompletions sessions={data.recentCompletions} />
      </div>
    );
  }

  if (data.state === "between") {
    return (
      <div className="space-y-5">
        {/* Week recap */}
        {data.weekRecap && <WeekRecapCard recap={data.weekRecap} />}

        {/* Next session countdown or request programming */}
        {data.nextSession && data.nextSession.daysUntil <= 14 ? (
          <NextSessionCard
            date={data.nextSession.date}
            name={data.nextSession.name}
            daysUntil={data.nextSession.daysUntil}
          />
        ) : (
          <RequestProgramming
            lastRequestDate={data.lastProgrammingRequest}
            coachName={data.coachName}
            variant="between"
          />
        )}

        {/* Quick actions */}
        <QuickActions
          readinessCheckedIn={data.readinessCheckedInToday}
          pendingQuestionnaires={data.pendingQuestionnaires}
        />

        {/* Recent completions */}
        <RecentCompletions sessions={data.recentCompletions} />
      </div>
    );
  }

  // cold-start
  return (
    <div className="space-y-5">
      {/* Request programming */}
      <RequestProgramming
        lastRequestDate={data.lastProgrammingRequest}
        coachName={data.coachName}
        variant="cold-start"
      />

      {/* Onboarding checklist */}
      {data.onboardingItems && (
        <OnboardingChecklist
          items={data.onboardingItems}
          coachName={data.coachName}
          coachAvatarUrl={data.coachAvatarUrl}
        />
      )}
    </div>
  );
}
