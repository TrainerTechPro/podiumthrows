"use client";

import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { ProgramPhase, ProgramSession } from "./_week-expansion";
import { getPhaseColor, WeekExpansion } from "./_week-expansion";

/* ─── Constants ──────────────────────────────────────────────────── */

const PHASE_ABBREV: Record<string, string> = {
  ACCUMULATION: "ACCUM",
  TRANSMUTATION: "TRANS",
  REALIZATION: "REAL",
  COMPETITION: "COMP",
};

/* ─── Timeline Colors ────────────────────────────────────────────── */

const TIMELINE_COLORS: Record<
  string,
  {
    barBg: string;
    barFill: string;
    diamond: string;
    diamondBorder: string;
    glow: string;
    label: string;
  }
> = {
  ACCUMULATION: {
    barBg: "bg-blue-500/10",
    barFill: "bg-blue-500",
    diamond: "bg-blue-500",
    diamondBorder: "border-blue-500/40",
    glow: "ring-blue-500/50 shadow-[0_0_8px_rgba(68,136,255,0.4)]",
    label: "text-blue-500 dark:text-blue-400",
  },
  TRANSMUTATION: {
    barBg: "bg-amber-500/10",
    barFill: "bg-amber-500",
    diamond: "bg-amber-500",
    diamondBorder: "border-amber-500/40",
    glow: "ring-amber-500/50 shadow-[0_0_8px_rgba(255,200,0,0.4)]",
    label: "text-amber-500 dark:text-amber-400",
  },
  REALIZATION: {
    barBg: "bg-emerald-500/10",
    barFill: "bg-emerald-500",
    diamond: "bg-emerald-500",
    diamondBorder: "border-emerald-500/40",
    glow: "ring-emerald-500/50 shadow-[0_0_8px_rgba(0,255,136,0.4)]",
    label: "text-emerald-500 dark:text-emerald-400",
  },
  COMPETITION: {
    barBg: "bg-red-500/10",
    barFill: "bg-red-500",
    diamond: "bg-red-500",
    diamondBorder: "border-red-500/40",
    glow: "ring-red-500/50 shadow-[0_0_8px_rgba(255,68,68,0.4)]",
    label: "text-red-500 dark:text-red-400",
  },
};

function getTimelineColor(phase: string) {
  return TIMELINE_COLORS[phase] ?? TIMELINE_COLORS.ACCUMULATION;
}

/* ─── Types ──────────────────────────────────────────────────────── */

type WeekStatus = "completed" | "current" | "future" | "skipped";

interface WeekData {
  weekNumber: number;
  phase: ProgramPhase;
  status: WeekStatus;
  sessions: ProgramSession[];
}

/* ─── Compute Weeks ──────────────────────────────────────────────── */

function computeWeekData(
  phases: ProgramPhase[],
  programStartDate: string
): { weeks: WeekData[]; currentWeek: number } {
  const allWeeks: WeekData[] = [];

  for (const phase of phases) {
    for (let w = phase.startWeek; w <= phase.endWeek; w++) {
      const sessions = phase.sessions.filter((s) => s.weekNumber === w);
      allWeeks.push({ weekNumber: w, phase, status: "future", sessions });
    }
  }

  if (allWeeks.length === 0) return { weeks: [], currentWeek: 0 };

  // Determine current week from calendar date
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const start = new Date(programStartDate).getTime();
  const rawWeek = Math.ceil((Date.now() - start) / msPerWeek);
  const lastWeek = allWeeks[allWeeks.length - 1].weekNumber;
  const currentWeek = Math.max(1, Math.min(rawWeek, lastWeek));

  // Set statuses based on session completion + calendar position
  for (const week of allWeeks) {
    const has = week.sessions.length > 0;
    const allDone = has && week.sessions.every((s) => s.status === "COMPLETED");
    const allSkip = has && week.sessions.every((s) => s.status === "SKIPPED");

    if (allSkip) week.status = "skipped";
    else if (allDone) week.status = "completed";
    else if (week.weekNumber === currentWeek) week.status = "current";
    else if (week.weekNumber < currentWeek) week.status = "completed";
    else week.status = "future";
  }

  return { weeks: allWeeks, currentWeek };
}

function getPhaseProgress(phase: ProgramPhase, currentWeek: number): number {
  if (phase.status === "COMPLETED") return 100;
  if (currentWeek < phase.startWeek) return 0;
  if (currentWeek > phase.endWeek) return 100;
  return Math.min(100, ((currentWeek - phase.startWeek + 0.5) / phase.durationWeeks) * 100);
}

/* ─── Diamond Visual ─────────────────────────────────────────────── */

function DiamondIcon({ weekData }: { weekData: WeekData }) {
  const tc = getTimelineColor(weekData.phase.phase);
  const base = "w-3 h-3 rotate-45 shrink-0 transition-all duration-200 inline-block";

  switch (weekData.status) {
    case "completed":
      return <span className={cn(base, tc.diamond)} />;
    case "current":
      return (
        <span className={cn(base, tc.diamond, "ring-2", tc.glow, "motion-safe:animate-pulse")} />
      );
    case "skipped":
      return <span className={cn(base, "bg-surface-400 dark:bg-surface-600")} />;
    default:
      return <span className={cn(base, "bg-transparent border-[1.5px]", tc.diamondBorder)} />;
  }
}

/* ─── PhaseTimeline ──────────────────────────────────────────────── */

export function PhaseTimeline({
  phases,
  programStartDate,
  configId,
}: {
  phases: ProgramPhase[];
  programStartDate: string;
  configId: string;
}) {
  const { weeks, currentWeek } = useMemo(
    () => computeWeekData(phases, programStartDate),
    [phases, programStartDate]
  );

  // Default: current week is pre-expanded
  const [selectedWeek, setSelectedWeek] = useState<number | null>(currentWeek || null);

  // Auto-scroll current week into view on mount (especially on mobile)
  useEffect(() => {
    const el = document.getElementById(`timeline-week-${currentWeek}`);
    el?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [currentWeek]);

  if (phases.length === 0 || weeks.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-muted">No phases generated yet.</p>
      </div>
    );
  }

  // Group weeks by phase for rendering
  const phaseWeeks = new Map<string, WeekData[]>();
  for (const week of weeks) {
    const arr = phaseWeeks.get(week.phase.id) ?? [];
    arr.push(week);
    phaseWeeks.set(week.phase.id, arr);
  }

  const toggleWeek = (wn: number) => setSelectedWeek((prev) => (prev === wn ? null : wn));

  const selectedData = selectedWeek
    ? (weeks.find((w) => w.weekNumber === selectedWeek) ?? null)
    : null;

  return (
    <div className="space-y-4">
      {/* ── Desktop Timeline (≥640px) ────────────────────────────── */}
      <div className="hidden sm:block card !p-4 space-y-3">
        {/* Phase labels */}
        <div className="flex gap-0.5">
          {phases.map((phase) => {
            const tc = getTimelineColor(phase.phase);
            return (
              <div
                key={phase.id}
                className="min-w-0 flex items-center justify-between gap-1"
                style={{ flex: phase.durationWeeks }}
              >
                <span
                  className={cn(
                    "text-nano font-semibold uppercase tracking-wider truncate",
                    tc.label
                  )}
                >
                  {phase.phase}
                </span>
                <span
                  className={cn(
                    "text-nano font-semibold px-1 py-0.5 rounded shrink-0",
                    phase.status === "COMPLETED"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : phase.status === "ACTIVE"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-surface-100 dark:bg-surface-800 text-muted"
                  )}
                >
                  {phase.status === "COMPLETED" ? "✓" : phase.status === "ACTIVE" ? "●" : "○"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="flex gap-0.5 h-1.5">
          {phases.map((phase, i) => {
            const tc = getTimelineColor(phase.phase);
            const progress = getPhaseProgress(phase, currentWeek);
            return (
              <div
                key={phase.id}
                className={cn(
                  "relative overflow-hidden",
                  tc.barBg,
                  i === 0 && "rounded-l-full",
                  i === phases.length - 1 && "rounded-r-full"
                )}
                style={{ flex: phase.durationWeeks }}
              >
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 transition-all duration-700",
                    tc.barFill,
                    i === 0 && "rounded-l-full",
                    progress >= 100 && i === phases.length - 1 && "rounded-r-full"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Diamonds + week numbers */}
        <div className="flex gap-0.5">
          {phases.map((phase) => {
            const pw = phaseWeeks.get(phase.id) ?? [];
            return (
              <div
                key={phase.id}
                className="flex justify-around"
                style={{ flex: phase.durationWeeks }}
              >
                {pw.map((week) => (
                  <button
                    key={week.weekNumber}
                    id={`timeline-week-${week.weekNumber}`}
                    type="button"
                    onClick={() => toggleWeek(week.weekNumber)}
                    className={cn(
                      "flex flex-col items-center gap-1 py-1 cursor-pointer transition-transform duration-200",
                      selectedWeek === week.weekNumber ? "scale-125" : "hover:scale-110"
                    )}
                    aria-label={`Week ${week.weekNumber}${week.status === "current" ? " (current)" : ""}`}
                  >
                    <DiamondIcon weekData={week} />
                    <span
                      className={cn(
                        "text-nano tabular-nums",
                        selectedWeek === week.weekNumber
                          ? "text-[var(--foreground)] font-bold"
                          : "text-muted"
                      )}
                    >
                      {week.weekNumber}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Mobile Timeline (<640px) ─────────────────────────────── */}
      <div className="sm:hidden card !p-3 space-y-1">
        {phases.map((phase) => {
          const colors = getPhaseColor(phase.phase);
          const tc = getTimelineColor(phase.phase);
          const pw = phaseWeeks.get(phase.id) ?? [];

          return (
            <div key={phase.id}>
              {/* Phase header */}
              <div className="flex items-center gap-2 py-2">
                <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", colors.dot)} />
                <span className={cn("text-xs font-semibold uppercase tracking-wider", tc.label)}>
                  {phase.phase}
                </span>
                <span className="text-nano text-muted tabular-nums">
                  Wk {phase.startWeek}–{phase.endWeek}
                </span>
                <span
                  className={cn(
                    "text-nano font-semibold px-1.5 py-0.5 rounded ml-auto",
                    phase.status === "COMPLETED"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : phase.status === "ACTIVE"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-surface-100 dark:bg-surface-800 text-muted"
                  )}
                >
                  {phase.status}
                </span>
              </div>

              {/* Week rows with vertical spine */}
              <div className="ml-1 border-l-2 border-surface-200 dark:border-surface-700 pl-3 space-y-0.5 pb-2">
                {pw.map((week) => (
                  <button
                    key={week.weekNumber}
                    id={`timeline-week-${week.weekNumber}`}
                    type="button"
                    onClick={() => toggleWeek(week.weekNumber)}
                    className={cn(
                      "flex items-center gap-2.5 w-full py-2 px-2 rounded-lg text-left transition-colors",
                      selectedWeek === week.weekNumber
                        ? "bg-surface-100 dark:bg-surface-800"
                        : "hover:bg-surface-50 dark:hover:bg-surface-800/50"
                    )}
                  >
                    <DiamondIcon weekData={week} />
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        week.status === "current"
                          ? cn("font-bold", tc.label)
                          : week.status === "completed"
                            ? "text-[var(--foreground)]"
                            : "text-muted"
                      )}
                    >
                      Week {week.weekNumber}
                    </span>
                    {week.status === "current" && (
                      <span className="text-nano text-muted ml-auto">← current</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Phase Summary Pills ──────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
        {phases.map((phase) => {
          const colors = getPhaseColor(phase.phase);
          return (
            <button
              key={phase.id}
              type="button"
              onClick={() => {
                const pw = phaseWeeks.get(phase.id) ?? [];
                const target =
                  pw.find((w) => w.status !== "completed" && w.status !== "skipped") ?? pw[0];
                if (target) {
                  setSelectedWeek(target.weekNumber);
                  // Scroll diamond into view
                  setTimeout(() => {
                    document.getElementById(`timeline-week-${target.weekNumber}`)?.scrollIntoView({
                      behavior: "smooth",
                      block: "nearest",
                      inline: "center",
                    });
                  }, 50);
                }
              }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                "bg-surface-100 dark:bg-surface-800/50 hover:bg-surface-200 dark:hover:bg-surface-700"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full shrink-0", colors.dot)} />
              <span className="text-[var(--foreground)]">
                {PHASE_ABBREV[phase.phase] ?? phase.phase}
              </span>
              <span className="text-muted">{phase.durationWeeks}wk</span>
              <span>
                {phase.status === "COMPLETED" ? "✓" : phase.status === "ACTIVE" ? "◐" : "○"}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Selected Week Expansion ──────────────────────────────── */}
      {selectedData && (
        <WeekExpansion
          weekNumber={selectedData.weekNumber}
          phase={selectedData.phase}
          sessions={selectedData.sessions}
          configId={configId}
        />
      )}
    </div>
  );
}
