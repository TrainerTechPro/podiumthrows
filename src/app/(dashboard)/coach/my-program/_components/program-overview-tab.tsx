"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import ReasoningCard from "./reasoning-card";
import { csrfHeaders } from "@/lib/csrf-client";

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
const DAY_NAMES_SHORT = ["", "M", "T", "W", "T", "F", "S", "S"];

const STATUS_STYLES: Record<string, string> = {
  PLANNED: "bg-surface-100 dark:bg-surface-800 text-muted",
  SCHEDULED: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  IN_PROGRESS: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  COMPLETED: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  SKIPPED: "bg-surface-100 dark:bg-surface-800 text-muted line-through",
};

export default function ProgramOverviewTab({
  program,
  todaySessions,
  weekSessions: initialWeekSessions,
  reasoningCards,
  adaptationProgress,
  currentPr,
}: ProgramOverviewTabProps) {
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(program.currentWeekNumber);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [scheduleData, setScheduleData] = useState<SessionData[]>(initialWeekSessions);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [movingSessionId, setMovingSessionId] = useState<string | null>(null);
  const [moveLoading, setMoveLoading] = useState(false);

  // Determine today's day of week (1=Mon, 7=Sun)
  const todayDow = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 7 : d;
  }, []);

  const totalWeeks = useMemo(
    () => program.phases.reduce((sum, p) => Math.max(sum, p.endWeek), 0),
    [program.phases],
  );

  const { activePhase, daysToComp, nonPhaseCards } = useMemo(() => {
    const ap = program.phases.find((p) => p.id === program.currentPhaseId);
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

    return { activePhase: ap, daysToComp: dtc, nonPhaseCards: npc };
  }, [program, reasoningCards]);

  // Phase for the selected week
  const selectedPhase = useMemo(
    () => program.phases.find((p) => p.startWeek <= selectedWeek && p.endWeek >= selectedWeek),
    [program.phases, selectedWeek],
  );

  // Sessions grouped by day of week
  const sessionsByDay = useMemo(() => {
    const map: Record<number, SessionData[]> = {};
    for (let d = 1; d <= 7; d++) map[d] = [];
    for (const s of scheduleData) {
      if (!map[s.dayOfWeek]) map[s.dayOfWeek] = [];
      map[s.dayOfWeek].push(s);
    }
    return map;
  }, [scheduleData]);

  // Fetch week sessions
  const fetchWeek = useCallback(
    async (week: number, signal?: AbortSignal) => {
      setLoadingWeek(true);
      try {
        const res = await fetch(
          `/api/throws/program/${program.id}/week?week=${week}`,
          { signal },
        );
        if (res.ok) {
          const json = await res.json();
          setScheduleData(json.data?.sessions ?? []);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        setLoadingWeek(false);
      }
    },
    [program.id],
  );

  // Re-fetch when selected week changes (skip initial if it's current week)
  useEffect(() => {
    if (selectedWeek === program.currentWeekNumber && initialWeekSessions.length > 0) {
      setScheduleData(initialWeekSessions);
      return;
    }
    const controller = new AbortController();
    fetchWeek(selectedWeek, controller.signal);
    return () => controller.abort();
  }, [selectedWeek, program.currentWeekNumber, initialWeekSessions, fetchWeek]);

  // Move session to a different day
  async function moveSession(sessionId: string, newDay: number) {
    setMoveLoading(true);
    try {
      const res = await fetch(
        `/api/throws/program/${program.id}/sessions/${sessionId}/reschedule`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ dayOfWeek: newDay }),
        },
      );
      if (res.ok) {
        // Optimistic update
        setScheduleData((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, dayOfWeek: newDay } : s)),
        );
      }
    } catch { /* swallow */ } finally {
      setMoveLoading(false);
      setMovingSessionId(null);
    }
  }

  const isCurrentWeek = selectedWeek === program.currentWeekNumber;
  const completedToday = todaySessions.filter((s) => s.status === "COMPLETED").length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Quick Stats — compact 2x2 on mobile */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <div className="card px-3 py-2.5 sm:p-4 border-l-2 border-l-primary-500">
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted">Throws/Wk</p>
          <p className="text-lg sm:text-2xl font-bold font-heading text-[var(--foreground)] leading-tight tabular-nums mt-0.5">
            {activePhase?.throwsPerWeekTarget ?? "—"}
          </p>
        </div>
        <div className="card px-3 py-2.5 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted">Phase</p>
          <p className="text-sm sm:text-lg font-bold font-heading text-[var(--foreground)] leading-tight mt-0.5 truncate">
            {activePhase ? PHASE_LABELS[activePhase.phase] ?? activePhase.phase : "—"}
          </p>
          {activePhase && (
            <p className="text-[10px] text-muted mt-0.5 hidden sm:block">
              Wk {program.currentWeekNumber - activePhase.startWeek + 1}/{activePhase.durationWeeks}
            </p>
          )}
        </div>
        <div className="card px-3 py-2.5 sm:p-4 border-l-2 border-l-emerald-500">
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted">Adapt.</p>
          <p className="text-lg sm:text-2xl font-bold font-heading text-[var(--foreground)] leading-tight tabular-nums mt-0.5">
            {adaptationProgress ? `${Math.round(adaptationProgress.progress)}%` : "0%"}
          </p>
        </div>
        <div className="card px-3 py-2.5 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted">To Comp</p>
          <p className="text-lg sm:text-2xl font-bold font-heading text-[var(--foreground)] leading-tight tabular-nums mt-0.5">
            {daysToComp ?? "—"}
          </p>
          {daysToComp !== null && (
            <p className="text-[10px] text-muted mt-0.5 hidden sm:block">days</p>
          )}
        </div>
      </div>

      {/* Goals — compact */}
      {(program.shortTermGoalLabel || program.goalDistance) && (
        <div className="card p-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted truncate">{program.shortTermGoalLabel || "Goal"}</span>
            <span className="font-medium text-[var(--foreground)] tabular-nums shrink-0 ml-2">
              {currentPr ? `${currentPr}m` : `${program.startingPr}m`} → {program.goalDistance}m
            </span>
          </div>
          {program.startingPr && program.goalDistance && program.goalDistance > program.startingPr && (() => {
            const progressPct = Math.min(100, Math.max(0, ((currentPr ?? program.startingPr) - program.startingPr) / (program.goalDistance - program.startingPr) * 100));
            return (
              <div
                className="h-1.5 bg-[var(--muted-bg)] rounded-full overflow-hidden"
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
          {program.longTermGoalLabel && (
            <p className="text-[10px] text-muted mt-1.5">
              Long-term: {program.longTermGoalLabel}
              {program.longTermGoalDistance && ` (${program.longTermGoalDistance}m)`}
            </p>
          )}
        </div>
      )}

      {/* ── Weekly Schedule ─────────────────────────────────────────── */}
      <div className="card p-4 sm:p-5">
        {/* Week Navigator */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setSelectedWeek((w) => Math.max(1, w - 1))}
            disabled={selectedWeek <= 1}
            className="p-1.5 rounded-lg hover:bg-[var(--muted-bg)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous week"
          >
            <svg className="w-4 h-4 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Week {selectedWeek}
              {isCurrentWeek && (
                <span className="ml-1.5 text-[10px] font-medium bg-primary-500/15 text-primary-600 dark:text-primary-400 px-1.5 py-0.5 rounded">
                  Current
                </span>
              )}
            </h3>
            {selectedPhase && (
              <p className="text-[10px] text-muted mt-0.5">
                {PHASE_LABELS[selectedPhase.phase]} — {selectedPhase.throwsPerWeekTarget} t/wk
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSelectedWeek((w) => Math.min(totalWeeks, w + 1))}
            disabled={selectedWeek >= totalWeeks}
            className="p-1.5 rounded-lg hover:bg-[var(--muted-bg)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next week"
          >
            <svg className="w-4 h-4 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day Strip */}
        <div className="grid grid-cols-7 gap-1 mb-3">
          {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
            const hasSessions = (sessionsByDay[dow]?.length ?? 0) > 0;
            const isToday = isCurrentWeek && dow === todayDow;
            const isSelected = selectedDay === dow;

            return (
              <button
                key={dow}
                type="button"
                onClick={() => setSelectedDay(isSelected ? null : dow)}
                className={`relative flex flex-col items-center py-1.5 sm:py-2 rounded-lg transition-all text-center ${
                  isSelected
                    ? "bg-primary-500/15 ring-1 ring-primary-500/40"
                    : isToday
                    ? "bg-[var(--muted-bg)]"
                    : "hover:bg-[var(--muted-bg)]/50"
                }`}
                aria-label={`${DAY_NAMES[dow]}${hasSessions ? `, ${sessionsByDay[dow].length} session(s)` : ", rest day"}`}
                aria-pressed={isSelected}
              >
                <span className={`text-[10px] sm:text-xs font-medium ${
                  isToday ? "text-primary-600 dark:text-primary-400" : "text-muted"
                }`}>
                  <span className="sm:hidden">{DAY_NAMES_SHORT[dow]}</span>
                  <span className="hidden sm:inline">{DAY_NAMES[dow]}</span>
                </span>
                {hasSessions ? (
                  <div className="flex gap-0.5 mt-1">
                    {sessionsByDay[dow].map((s) => (
                      <span
                        key={s.id}
                        className={`w-1.5 h-1.5 rounded-full ${
                          s.status === "COMPLETED"
                            ? "bg-emerald-500"
                            : s.status === "IN_PROGRESS"
                            ? "bg-amber-500"
                            : "bg-primary-500"
                        }`}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="w-1.5 h-1.5 mt-1 rounded-full bg-transparent" />
                )}
              </button>
            );
          })}
        </div>

        {/* Session List */}
        {loadingWeek ? (
          <div className="py-6 text-center">
            <div className="animate-pulse text-xs text-muted">Loading sessions...</div>
          </div>
        ) : (
          <div className="space-y-1">
            {(selectedDay ? [selectedDay] : [1, 2, 3, 4, 5, 6, 7]).map((dow) => {
              const sessions = sessionsByDay[dow] ?? [];
              if (selectedDay && sessions.length === 0) {
                return (
                  <div key={dow} className="py-6 text-center">
                    <p className="text-xs text-muted">No sessions on {DAY_NAMES[dow]}</p>
                    <p className="text-[10px] text-muted mt-1">Rest day</p>
                  </div>
                );
              }
              if (!selectedDay && sessions.length === 0) return null;

              return (
                <div key={dow}>
                  {!selectedDay && (
                    <div className="flex items-center gap-2 px-1 py-1.5">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                        isCurrentWeek && dow === todayDow
                          ? "text-primary-600 dark:text-primary-400"
                          : "text-muted"
                      }`}>
                        {DAY_NAMES[dow]}
                        {isCurrentWeek && dow === todayDow && " — Today"}
                      </span>
                      <div className="flex-1 h-px bg-[var(--card-border)]" />
                    </div>
                  )}
                  {sessions.map((session) => (
                    <div key={session.id} className="relative group">
                      <Link
                        href={`/coach/my-program/session/${session.id}`}
                        className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-[var(--muted-bg)]/50 transition-all"
                      >
                        {/* Status dot */}
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          session.status === "COMPLETED" ? "bg-emerald-500"
                          : session.status === "IN_PROGRESS" ? "bg-amber-500"
                          : "bg-surface-300 dark:bg-surface-600"
                        }`} />

                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-[var(--foreground)] block truncate">
                            {session.focusLabel}
                          </span>
                          <span className="text-[10px] sm:text-xs text-muted">
                            {session.totalThrowsTarget}t · ~{session.estimatedDuration}min
                          </span>
                        </div>

                        <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLES[session.status] ?? ""}`}>
                          {session.status === "COMPLETED" ? (
                            <svg className="w-3 h-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            session.status.replace("_", " ")
                          )}
                        </span>

                        <svg className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>

                      {/* Move button — only for non-completed sessions */}
                      {session.status !== "COMPLETED" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMovingSessionId(movingSessionId === session.id ? null : session.id);
                          }}
                          className="absolute right-1 top-1 p-1 rounded-md hover:bg-[var(--muted-bg)] text-muted opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          aria-label={`Move ${session.focusLabel} to different day`}
                          title="Move to different day"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </button>
                      )}

                      {/* Day picker for moving */}
                      {movingSessionId === session.id && (
                        <div className="mx-2.5 mb-2 p-2 rounded-lg bg-[var(--muted-bg)] border border-[var(--card-border)]">
                          <p className="text-[10px] text-muted mb-1.5 font-medium">Move to:</p>
                          <div className="grid grid-cols-7 gap-1">
                            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => moveSession(session.id, d)}
                                disabled={d === session.dayOfWeek || moveLoading}
                                className={`text-xs py-1.5 rounded-md transition-all font-medium ${
                                  d === session.dayOfWeek
                                    ? "bg-primary-500/20 text-primary-600 dark:text-primary-400 cursor-default"
                                    : "hover:bg-surface-200 dark:hover:bg-surface-700 text-[var(--foreground)]"
                                } disabled:opacity-40`}
                              >
                                {DAY_NAMES_SHORT[d]}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Empty state for the whole week */}
            {!selectedDay && scheduleData.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-xs text-muted">No sessions scheduled for week {selectedWeek}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phase Timeline — collapsible */}
      <div className="card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Phase Timeline</h3>

        {/* Horizontal bar */}
        <div className="flex h-2.5 rounded-full overflow-hidden mb-3">
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
          <div className="relative h-1.5 mb-3">
            <div
              className="absolute top-0 w-0.5 h-1.5 bg-[var(--foreground)]"
              style={{ left: `${(program.currentWeekNumber / totalWeeks) * 100}%` }}
            />
          </div>
        )}

        {/* Phase list */}
        <div className="space-y-1">
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
                  className={`w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl transition-all cursor-pointer hover:bg-[var(--muted-bg)]/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)] ${
                    isCurrent ? "bg-primary-500/[0.08] ring-1 ring-primary-500/30" : ""
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${PHASE_COLORS[phase.phase] ?? "bg-surface-400"}`} aria-hidden="true" />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="text-xs sm:text-sm font-medium text-[var(--foreground)]">
                        {PHASE_LABELS[phase.phase] ?? phase.phase}
                      </span>
                      <span className="text-[10px] sm:text-xs text-muted">
                        Wk {phase.startWeek}-{phase.endWeek}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] bg-primary-500/20 text-primary-600 dark:text-primary-400 px-1 py-0.5 rounded">
                          Now
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-xs text-muted shrink-0 tabular-nums">
                    {phase.throwsPerWeekTarget} t/wk
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 text-muted transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div id={detailPanelId} className={isExpanded && phaseCard ? "ml-5 sm:ml-6 mt-1.5" : "hidden"}>
                  {phaseCard && <ReasoningCard {...phaseCard} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Overall progress */}
        <div className="mt-3 pt-2.5 border-t border-[var(--card-border)]">
          <div className="flex justify-between text-[10px] sm:text-xs text-muted mb-1">
            <span>Progress</span>
            <span>Week {program.currentWeekNumber} of {totalWeeks}</span>
          </div>
          <div
            className="h-1.5 bg-[var(--muted-bg)] rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={program.currentWeekNumber}
            aria-valuemin={1}
            aria-valuemax={totalWeeks}
            aria-label={`Program progress: week ${program.currentWeekNumber} of ${totalWeeks}`}
          >
            <div
              className="h-full bg-[var(--color-gold)] rounded-full transition-all"
              style={{ width: `${totalWeeks > 0 ? Math.min(100, (program.currentWeekNumber / totalWeeks) * 100) : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Today's Sessions — only shown on current week view */}
      {isCurrentWeek && todaySessions.length > 0 && (
        <div className="card p-4 sm:p-5 border-l-2 border-l-primary-500">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Today</h3>
            <span className="text-[10px] text-muted tabular-nums">
              {completedToday}/{todaySessions.length} done
            </span>
          </div>
          <div className="space-y-1.5">
            {todaySessions.map((session) => (
              <Link
                key={session.id}
                href={`/coach/my-program/session/${session.id}`}
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[var(--card-border)] hover:border-primary-500/30 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-[var(--foreground)] block truncate">
                    {session.focusLabel}
                  </span>
                  <span className="text-[10px] text-muted">
                    {session.totalThrowsTarget}t · ~{session.estimatedDuration}min
                  </span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLES[session.status] ?? ""}`}>
                  {session.status === "COMPLETED" ? "Done" : "Start"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Reasoning Cards */}
      {nonPhaseCards.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Program Reasoning
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {nonPhaseCards.map((card) => (
              <ReasoningCard key={card.id} {...card} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
