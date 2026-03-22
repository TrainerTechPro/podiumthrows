"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Clock,
  Dumbbell,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { NumberFlow } from "@/components/ui/NumberFlow";
import {
  Tabs,
  TabList,
  TabTrigger,
  TabPanel,
} from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface ProgramSession {
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

interface ProgramPhase {
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

interface TrainingProgram {
  id: string;
  event: string;
  gender: string;
  status: string;
  startDate: string;
  targetDate: string;
  goalDistance: number;
  startingPr: number;
  daysPerWeek: number;
  sessionsPerDay: number;
  phases: ProgramPhase[];
}

interface SelfProgramConfig {
  id: string;
  event: string;
  gender: string;
  programType: string;
  daysPerWeek: number;
  sessionsPerDay: number;
  currentPR: number;
  goalDistance: number;
  generationMode: string;
  generationCount: number;
  currentPhaseIndex: number;
  isActive: boolean;
  startDate: string;
  createdAt: string;
}

interface ProgramDetailProps {
  config: SelfProgramConfig;
  program: TrainingProgram;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSessionType(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const DAY_NAMES: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/* ─── Phase Colors ───────────────────────────────────────────────────────── */

const PHASE_COLORS: Record<
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

function getPhaseColor(phase: string) {
  return PHASE_COLORS[phase] ?? PHASE_COLORS.ACCUMULATION;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PLANNED: {
    bg: "bg-surface-100 dark:bg-surface-800",
    text: "text-surface-600 dark:text-surface-400",
  },
  SCHEDULED: {
    bg: "bg-surface-100 dark:bg-surface-800",
    text: "text-surface-600 dark:text-surface-400",
  },
  IN_PROGRESS: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-300",
  },
  ACTIVE: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-300",
  },
  COMPLETED: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  SKIPPED: {
    bg: "bg-surface-100 dark:bg-surface-800",
    text: "text-surface-500 dark:text-surface-500",
  },
};

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.PLANNED;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function ProgramDetail({ config, program }: ProgramDetailProps) {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [generating, setGenerating] = useState(false);

  const phases = program.phases;
  const currentPhase = phases[config.currentPhaseIndex] ?? phases[0] ?? null;

  // All sessions across phases
  const allSessions = useMemo(
    () => phases.flatMap((p) => p.sessions),
    [phases],
  );

  // Volume stats
  const totalThrowsTarget = useMemo(
    () => allSessions.reduce((sum, s) => sum + s.totalThrowsTarget, 0),
    [allSessions],
  );
  const completedSessions = useMemo(
    () => allSessions.filter((s) => s.status === "COMPLETED").length,
    [allSessions],
  );
  const totalSessions = allSessions.length;
  const completionPct =
    totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // Generate next phase: show button when 80%+ through current phase
  const canGenerateNext = useMemo(() => {
    if (!currentPhase) return false;

    const programStart = new Date(program.startDate);
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;

    // Phase start/end dates relative to program start
    const phaseStartDate = new Date(
      programStart.getTime() + (currentPhase.startWeek - 1) * msPerWeek,
    );
    const phaseEndDate = new Date(
      programStart.getTime() + currentPhase.endWeek * msPerWeek,
    );

    const now = Date.now();
    const phaseDuration = phaseEndDate.getTime() - phaseStartDate.getTime();
    if (phaseDuration <= 0) return false;

    const elapsed = now - phaseStartDate.getTime();
    const progress = elapsed / phaseDuration;

    return progress >= 0.8;
  }, [currentPhase, program.startDate]);

  const handleGenerateNext = async () => {
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/athlete/self-program/${config.id}/generate-next`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate next phase");
      }
      success("Next phase generated", "Your program has been extended with a new training phase.");
      router.refresh();
    } catch (err) {
      showError(
        "Generation failed",
        err instanceof Error ? err.message : "Please try again later.",
      );
    } finally {
      setGenerating(false);
    }
  };

  // Default tab to current phase
  const defaultTabId = currentPhase?.id ?? phases[0]?.id ?? "";

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <ScrollProgressBar />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <Link
          href="/athlete/self-program"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          Back to Self Program
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
              {formatEventName(config.event)} Program
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                Active
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                Self-Generated
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Program Summary Cards ──────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Program Overview
        </h2>
        <StaggeredList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="card p-4 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Event
            </p>
            <p className="text-sm font-bold font-heading text-[var(--foreground)]">
              {formatEventName(config.event)}
            </p>
            <p className="text-xs text-muted capitalize">
              {config.gender.toLowerCase()}
            </p>
          </div>

          <div className="card p-4 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Schedule
            </p>
            <p className="text-sm font-bold font-heading text-[var(--foreground)]">
              {config.daysPerWeek} days/week
            </p>
            <p className="text-xs text-muted">
              {config.sessionsPerDay} session{config.sessionsPerDay !== 1 ? "s" : ""}/day
            </p>
          </div>

          <div className="card p-4 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Goal
            </p>
            <p className="text-sm font-bold font-heading text-primary-500 tabular-nums">
              <AnimatedNumber value={config.goalDistance} decimals={2} />m
            </p>
          </div>

          <div className="card p-4 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Current PR
            </p>
            <p className="text-sm font-bold font-heading text-[var(--foreground)] tabular-nums">
              <AnimatedNumber value={config.currentPR} decimals={2} />m
            </p>
          </div>

          <div className="card p-4 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Mode
            </p>
            <p className="text-sm font-bold font-heading text-[var(--foreground)]">
              {config.generationMode === "AUTOPILOT" ? "Autopilot" : "Guided"}
            </p>
          </div>

          <div className="card p-4 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Generations
            </p>
            <p className="text-sm font-bold font-heading text-[var(--foreground)] tabular-nums">
              <AnimatedNumber value={config.generationCount} />
            </p>
            <p className="text-xs text-muted">phases generated</p>
          </div>
        </StaggeredList>
      </section>

      {/* ── Volume Stats ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Volume Stats
        </h2>
        <StaggeredList className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Throws Target"
            value={totalThrowsTarget}
            icon={<Target size={16} strokeWidth={1.75} aria-hidden="true" />}
            accent="primary"
          />
          <StatCard
            label="Completed Sessions"
            value={completedSessions}
            unit={`/ ${totalSessions}`}
            icon={<Dumbbell size={16} strokeWidth={1.75} aria-hidden="true" />}
            accent="success"
          />
          <StatCard
            label="Completion"
            value={completionPct}
            unit="%"
            icon={<TrendingUp size={16} strokeWidth={1.75} aria-hidden="true" />}
            accent={completionPct >= 80 ? "success" : completionPct >= 50 ? "primary" : "warning"}
          />
        </StaggeredList>
      </section>

      {/* ── Phase Timeline (Tabs) ──────────────────────────────────────── */}
      {phases.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Phase Timeline
          </h2>

          <Tabs defaultTab={defaultTabId}>
            <TabList variant="underline" className="overflow-x-auto custom-scrollbar">
              {phases.map((phase) => {
                const colors = getPhaseColor(phase.phase);
                const isCurrent = phase.id === currentPhase?.id;

                return (
                  <TabTrigger
                    key={phase.id}
                    id={phase.id}
                    variant="underline"
                    icon={
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          isCurrent ? colors.dot : "bg-surface-300 dark:bg-surface-600",
                        )}
                      />
                    }
                    badge={
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
                          getStatusStyle(phase.status).bg,
                          getStatusStyle(phase.status).text,
                        )}
                      >
                        {phase.status}
                      </span>
                    }
                  >
                    <span className="flex flex-col items-start leading-tight">
                      <span className="text-xs font-semibold">
                        {phase.phase}
                      </span>
                      <span className="text-[10px] text-muted tabular-nums">
                        Wk {phase.startWeek}&ndash;{phase.endWeek}
                      </span>
                    </span>
                  </TabTrigger>
                );
              })}
            </TabList>

            {phases.map((phase) => (
              <TabPanel key={phase.id} id={phase.id} className="mt-4">
                <PhaseContent phase={phase} programStartDate={program.startDate} />
              </TabPanel>
            ))}
          </Tabs>
        </section>
      )}

      {/* ── Generate Next Phase ────────────────────────────────────────── */}
      {canGenerateNext && (
        <section className="space-y-3">
          <div className="card p-6 text-center space-y-4 border-dashed border-2 border-primary-300 dark:border-primary-500/30">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center mx-auto">
              <Sparkles
                size={22}
                strokeWidth={1.75}
                className="text-primary-500"
                aria-hidden="true"
              />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold font-heading text-[var(--foreground)]">
                Ready for the Next Phase
              </h3>
              <p className="text-sm text-muted max-w-md mx-auto">
                You&apos;re 80%+ through your current phase. Generate the next
                mesocycle to keep your training on track.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={handleGenerateNext}
              loading={generating}
              leftIcon={
                generating ? undefined : (
                  <Zap size={16} strokeWidth={1.75} aria-hidden="true" />
                )
              }
            >
              {generating ? "Generating..." : "Generate Next Phase"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

/* ─── Phase Content ──────────────────────────────────────────────────────── */

function PhaseContent({
  phase,
  programStartDate,
}: {
  phase: ProgramPhase;
  programStartDate: string;
}) {
  const colors = getPhaseColor(phase.phase);

  // Group sessions by week
  const weekGroups = useMemo(() => {
    const groups = new Map<number, ProgramSession[]>();
    for (const session of phase.sessions) {
      const existing = groups.get(session.weekNumber) ?? [];
      existing.push(session);
      groups.set(session.weekNumber, existing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [phase.sessions]);

  // Phase-level stats
  const completedInPhase = phase.sessions.filter(
    (s) => s.status === "COMPLETED",
  ).length;
  const totalInPhase = phase.sessions.length;
  const phaseThrowsTarget = phase.sessions.reduce(
    (sum, s) => sum + s.totalThrowsTarget,
    0,
  );
  const phaseProgress =
    totalInPhase > 0 ? Math.round((completedInPhase / totalInPhase) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Phase summary bar */}
      <div
        className={cn(
          "rounded-xl border p-4 space-y-3",
          colors.bg,
          colors.border,
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={cn("w-2.5 h-2.5 rounded-full", colors.dot)} />
            <span className={cn("text-sm font-bold uppercase tracking-wider", colors.text)}>
              {phase.phase}
            </span>
            <span className="text-xs text-muted tabular-nums">
              {phase.durationWeeks} weeks
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="tabular-nums">
              <NumberFlow value={phase.throwsPerWeekTarget} /> throws/wk target
            </span>
            <span className="tabular-nums">
              {phase.strengthDaysTarget} strength days
            </span>
          </div>
        </div>
        <ProgressBar
          value={phaseProgress}
          variant="primary"
          size="sm"
          showLabel
          label={`${completedInPhase}/${totalInPhase} sessions`}
        />
        {/* Exercise distribution */}
        <div className="flex flex-wrap gap-3 text-[11px] text-muted">
          <span>
            CE <strong className={colors.text}>{Math.round(phase.cePercent)}%</strong>
          </span>
          <span>
            SDE <strong className={colors.text}>{Math.round(phase.sdPercent)}%</strong>
          </span>
          <span>
            SPE <strong className={colors.text}>{Math.round(phase.spPercent)}%</strong>
          </span>
          <span>
            GPE <strong className={colors.text}>{Math.round(phase.gpPercent)}%</strong>
          </span>
        </div>
      </div>

      {/* Session list grouped by week */}
      {weekGroups.map(([weekNum, sessions]) => (
        <div key={weekNum} className="space-y-2">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider pl-1">
            Week {weekNum}
          </h3>
          <StaggeredList className="grid grid-cols-1 gap-2">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                programStartDate={programStartDate}
              />
            ))}
          </StaggeredList>
        </div>
      ))}

      {phase.sessions.length === 0 && (
        <p className="text-sm text-muted text-center py-6">
          No sessions in this phase yet.
        </p>
      )}
    </div>
  );
}

/* ─── Session Card ───────────────────────────────────────────────────────── */

function SessionCard({
  session,
  programStartDate,
}: {
  session: ProgramSession;
  programStartDate: string;
}) {
  const statusStyle = getStatusStyle(session.status);
  const dayName = DAY_NAMES[session.dayOfWeek] ?? `Day ${session.dayOfWeek}`;

  return (
    <div className="card p-4 flex items-center gap-4">
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
    </div>
  );
}
