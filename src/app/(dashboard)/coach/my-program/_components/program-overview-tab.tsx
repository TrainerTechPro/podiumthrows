"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import ReasoningCard from "./reasoning-card";

interface PhaseData {
  id: string;
  phase: string;
  phaseOrder: number;
  startWeek: number;
  endWeek: number;
  durationWeeks: number;
  throwsPerWeekTarget: number;
  strengthDaysTarget: number;
  status: string;
  _count: { sessions: number };
}

interface SessionData {
  id: string;
  weekNumber: number;
  dayOfWeek: number;
  dayType: string;
  sessionType: string;
  focusLabel: string;
  totalThrowsTarget: number;
  estimatedDuration: number;
  status: string;
}

interface ReasoningCardData {
  id: string;
  title: string;
  brief: string;
  details: string;
  category: "phase" | "volume" | "exercise" | "taper" | "deficit";
  reference?: string;
}

interface ProgramOverviewTabProps {
  program: {
    id: string;
    event: string;
    gender: string;
    status: string;
    startDate: string;
    targetDate: string | null;
    goalDistance: number | null;
    startingPr: number | null;
    daysPerWeek: number;
    currentWeekNumber: number;
    currentPhaseId: string | null;
    shortTermGoalLabel: string | null;
    longTermGoalLabel: string | null;
    longTermGoalDistance: number | null;
    competitionCalendar: string | null;
    phases: PhaseData[];
  };
  todaySessions: SessionData[];
  weekSessions: SessionData[];
  reasoningCards: ReasoningCardData[];
  adaptationProgress?: { progress: number; phase: string; label: string };
  currentPr?: number;
}

const PHASE_LABELS: Record<string, string> = {
  ACCUMULATION: "Accumulation",
  TRANSMUTATION: "Transmutation",
  REALIZATION: "Realization",
  COMPETITION: "Competition",
};

const PHASE_COLORS: Record<string, string> = {
  ACCUMULATION: "bg-blue-500",
  TRANSMUTATION: "bg-amber-500",
  REALIZATION: "bg-emerald-500",
  COMPETITION: "bg-red-500",
};

const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_STYLES: Record<string, string> = {
  PLANNED: "bg-[var(--muted-bg)] text-muted",
  SCHEDULED: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  IN_PROGRESS: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  COMPLETED: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  SKIPPED: "bg-[var(--muted-bg)] text-muted",
};

export default function ProgramOverviewTab({
  program,
  todaySessions,
  weekSessions,
  reasoningCards,
  adaptationProgress,
  currentPr,
}: ProgramOverviewTabProps) {
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null);

  // M6-A: Memoize derived values — JSON.parse, sort, filter only run when deps change
  const { activePhase, totalWeeks, completedToday, daysToComp, nonPhaseCards } = useMemo(() => {
    const ap = program.phases.find((p) => p.id === program.currentPhaseId);
    const tw = program.phases.reduce((sum, p) => Math.max(sum, p.endWeek), 0);
    const ct = todaySessions.filter((s) => s.status === "COMPLETED").length;
    const npc = reasoningCards.filter((c) => !c.id.startsWith("phase-"));

    let dtc: number | null = null;
    const now = Date.now();
    if (program.competitionCalendar) {
      try {
        const comps = JSON.parse(program.competitionCalendar) as Array<{ date: string }>;
        const upcoming = comps
          .map((c) => new Date(c.date).getTime())
          .filter((t) => t > now)
          .sort((a, b) => a - b);
        if (upcoming.length > 0) {
          dtc = Math.ceil((upcoming[0] - now) / (1000 * 60 * 60 * 24));
        }
      } catch { /* invalid JSON */ }
    }
    if (dtc === null && program.targetDate) {
      const targetTime = new Date(program.targetDate).getTime();
      if (targetTime > now) {
        dtc = Math.ceil((targetTime - now) / (1000 * 60 * 60 * 24));
      }
    }

    return { activePhase: ap, totalWeeks: tw, completedToday: ct, daysToComp: dtc, nonPhaseCards: npc };
  }, [program, todaySessions, reasoningCards]);

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Throws/Week"
          value={activePhase?.throwsPerWeekTarget ?? "—"}
          accent="primary"
        />
        <StatCard
          label="Current Phase"
          value={activePhase ? PHASE_LABELS[activePhase.phase] ?? activePhase.phase : "—"}
          note={activePhase ? `Week ${program.currentWeekNumber - activePhase.startWeek + 1}/${activePhase.durationWeeks}` : undefined}
        />
        <StatCard
          label="Adaptation"
          value={adaptationProgress ? `${Math.round(adaptationProgress.progress)}%` : "—"}
          note={adaptationProgress?.label}
          accent="success"
        />
        <StatCard
          label="Days to Comp"
          value={daysToComp ?? "—"}
          accent={daysToComp !== null && daysToComp <= 21 ? "warning" : "none"}
        />
      </div>

      {/* Goals Card */}
      {(program.shortTermGoalLabel || program.goalDistance) && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Goals</h3>
          <div className="space-y-3">
            {program.shortTermGoalLabel && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted">{program.shortTermGoalLabel}</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {currentPr ? `${currentPr}m` : `${program.startingPr}m`} → {program.goalDistance}m
                  </span>
                </div>
                {program.startingPr && program.goalDistance && program.goalDistance > program.startingPr && (() => {
                  const progressPct = Math.min(100, Math.max(0, ((currentPr ?? program.startingPr) - program.startingPr) / (program.goalDistance - program.startingPr) * 100));
                  return (
                    <div
                      className="h-2 bg-[var(--muted-bg)] rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuenow={Math.round(progressPct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Goal progress: ${currentPr ?? program.startingPr}m of ${program.goalDistance}m`}
                    >
                      <div
                        className="h-full bg-[var(--color-gold)] rounded-full transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  );
                })()}
              </div>
            )}
            {program.longTermGoalLabel && (
              <div className="text-xs text-muted">
                Long-term: {program.longTermGoalLabel}
                {program.longTermGoalDistance && ` (${program.longTermGoalDistance}m)`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Phase Timeline */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Phase Timeline</h3>

        {/* Horizontal bar */}
        <div className="flex h-3 rounded-full overflow-hidden mb-4">
          {program.phases.map((phase) => {
            const widthPct = totalWeeks > 0 ? (phase.durationWeeks / totalWeeks) * 100 : 25;
            return (
              <div
                key={phase.id}
                className={`${PHASE_COLORS[phase.phase] ?? "bg-surface-400"} ${
                  phase.id === program.currentPhaseId ? "ring-2 ring-white dark:ring-surface-900 ring-inset" : ""
                }`}
                style={{ width: `${widthPct}%` }}
                title={`${PHASE_LABELS[phase.phase]} — Weeks ${phase.startWeek}-${phase.endWeek}`}
              />
            );
          })}
        </div>

        {/* Position marker */}
        {totalWeeks > 0 && (
          <div className="relative h-2 mb-4">
            <div
              className="absolute top-0 w-0.5 h-2 bg-[var(--foreground)]"
              style={{ left: `${(program.currentWeekNumber / totalWeeks) * 100}%` }}
            />
          </div>
        )}

        {/* Phase list */}
        <div className="space-y-2">
          {program.phases.map((phase) => {
            const isCurrent = phase.id === program.currentPhaseId;
            const isExpanded = expandedPhaseId === phase.id;
            const phaseCard = reasoningCards.find(
              (c) => c.id === `phase-${phase.phase.toLowerCase()}`,
            );
            const detailPanelId = `phase-detail-${phase.id}`;
            return (
              <div key={phase.id}>
                <button
                  type="button"
                  onClick={() => setExpandedPhaseId(isExpanded ? null : phase.id)}
                  aria-expanded={isExpanded}
                  aria-controls={detailPanelId}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer hover:bg-[var(--muted-bg)]/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)] ${
                    isCurrent ? "bg-primary-500/[0.08] ring-1 ring-primary-500/30" : ""
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full shrink-0 ${PHASE_COLORS[phase.phase] ?? "bg-surface-400"}`} aria-hidden="true" />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">
                        {PHASE_LABELS[phase.phase] ?? phase.phase}
                      </span>
                      <span className="text-xs text-muted">
                        Weeks {phase.startWeek}-{phase.endWeek}
                      </span>
                      {isCurrent && (
                        <span className="text-xs bg-primary-500/20 text-primary-600 px-1.5 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted shrink-0">
                    {phase.throwsPerWeekTarget} t/wk
                  </span>
                  <svg
                    className={`w-4 h-4 text-muted transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div id={detailPanelId} className={isExpanded && phaseCard ? "ml-6 mt-2" : "hidden"}>
                  {phaseCard && <ReasoningCard {...phaseCard} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Overall progress */}
        <div className="mt-4 pt-3 border-t border-[var(--card-border)]">
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>Overall Progress</span>
            <span>Week {program.currentWeekNumber} of {totalWeeks}</span>
          </div>
          <div
            className="h-2 bg-[var(--muted-bg)] rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={program.currentWeekNumber}
            aria-valuemin={1}
            aria-valuemax={totalWeeks}
            aria-label={`Overall program progress: week ${program.currentWeekNumber} of ${totalWeeks}`}
          >
            <div
              className="h-full bg-[var(--color-gold)] rounded-full transition-all"
              style={{ width: `${totalWeeks > 0 ? Math.min(100, (program.currentWeekNumber / totalWeeks) * 100) : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Today's Sessions */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Today</h3>
          {todaySessions.length > 0 && (
            <span className="text-xs text-muted">
              {completedToday}/{todaySessions.length} done
            </span>
          )}
        </div>

        {todaySessions.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">
            No sessions scheduled for today. Rest day!
          </p>
        ) : (
          <div className="space-y-2">
            {todaySessions.map((session) => (
              <Link
                key={session.id}
                href={`/coach/my-program/session/${session.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-[var(--card-border)] hover:border-primary-500/20 transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {session.focusLabel}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_STYLES[session.status] ?? ""}`}>
                      {session.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Day {session.dayType} &middot; {session.totalThrowsTarget} throws &middot; ~{session.estimatedDuration}min
                  </p>
                </div>
                <svg className="w-4 h-4 text-muted group-hover:text-[var(--color-gold)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* This Week */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">
          Week {program.currentWeekNumber}
        </h3>
        {weekSessions.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">No sessions this week.</p>
        ) : (
          <div className="space-y-1.5">
            {weekSessions.map((session) => (
              <Link
                key={session.id}
                href={`/coach/my-program/session/${session.id}`}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--muted-bg)]/50 transition-all"
              >
                <span className="text-xs font-medium text-muted w-8">
                  {DAY_NAMES[session.dayOfWeek] ?? `D${session.dayOfWeek}`}
                </span>
                <span className="text-sm text-[var(--foreground)] flex-1">
                  {session.focusLabel}
                </span>
                <span className="text-xs text-muted">{session.totalThrowsTarget}t</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_STYLES[session.status] ?? ""}`}>
                  {session.status === "COMPLETED" ? (
                    <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    session.status.replace("_", " ")
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Reasoning Cards */}
      {nonPhaseCards.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Program Reasoning
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {nonPhaseCards.map((card) => (
              <ReasoningCard key={card.id} {...card} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
