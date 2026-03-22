"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  Dumbbell,
  ClipboardList,
  Calendar,
  ChevronRight,
  RefreshCw,
  XCircle,
  AlertTriangle,
  Trophy,
  Target,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCard } from "@/components/ui/StatCard";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface ProgramPhase {
  id: string;
  phase: string;
  phaseOrder: number;
  startWeek: number;
  endWeek: number;
  durationWeeks: number;
}

interface ProgramSession {
  id: string;
  status: string;
  scheduledDate: string | null;
  sessionType: string;
  focusLabel: string;
  estimatedDuration: number | null;
  weekNumber: number;
}

interface TrainingProgram {
  id: string;
  startDate: string;
  targetDate: string;
  goalDistance: number;
  startingPr: number;
  phases: ProgramPhase[];
  sessions: ProgramSession[];
}

interface ActiveConfig {
  id: string;
  event: string;
  programType: string;
  currentPhaseIndex: number;
  generationCount: number;
  competitionDates: unknown;
  trainingProgram: TrainingProgram | null;
}

interface DraftConfig {
  id: string;
  updatedAt: string;
  event: string;
}

type HubState = "blocked" | "empty" | "draft" | "active";

interface SelfProgramHubProps {
  state: HubState;
  config?: ActiveConfig | null;
  draft?: DraftConfig | null;
  eventMismatch?: boolean;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 0) return `${Math.abs(diffDays)}d ago`;
  return `In ${diffDays} days`;
}

function formatSessionType(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const PHASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ACCUMULATION: {
    bg: "bg-primary-50 dark:bg-primary-500/10",
    text: "text-primary-700 dark:text-primary-300",
    border: "border-primary-200 dark:border-primary-500/30",
  },
  TRANSMUTATION: {
    bg: "bg-info-50 dark:bg-info-500/10",
    text: "text-info-700 dark:text-info-300",
    border: "border-info-200 dark:border-info-500/30",
  },
  REALIZATION: {
    bg: "bg-success-50 dark:bg-success-500/10",
    text: "text-success-700 dark:text-success-300",
    border: "border-success-200 dark:border-success-500/30",
  },
  COMPETITION: {
    bg: "bg-warning-50 dark:bg-warning-500/10",
    text: "text-warning-700 dark:text-warning-300",
    border: "border-warning-200 dark:border-warning-500/30",
  },
};

function getPhaseColor(phase: string) {
  return PHASE_COLORS[phase] ?? PHASE_COLORS.ACCUMULATION;
}

/* ─── Blocked State ─────────────────────────────────────────────────────── */

function BlockedView() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="card max-w-md w-full p-8 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mx-auto">
          <Lock size={24} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold font-heading text-[var(--foreground)]">
            Self Program
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            This feature requires a self-coached account. Upgrade to build your
            own Bondarchuk training program.
          </p>
        </div>
        <Link href="/athlete/settings">
          <Button variant="primary" size="md" className="w-full">
            Go to Settings
          </Button>
        </Link>
      </div>
    </div>
  );
}

/* ─── Empty State ───────────────────────────────────────────────────────── */

function EmptyView() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Link
        href="/athlete/self-program/create"
        className="card card-interactive max-w-lg w-full p-8 text-center space-y-5 group"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center mx-auto">
          <Dumbbell
            size={28}
            strokeWidth={1.75}
            className="text-primary-500"
            aria-hidden="true"
          />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Build Your Bondarchuk Program
          </h1>
          <p className="text-sm text-muted leading-relaxed max-w-sm mx-auto">
            Create a personalized training program based on Dr. Bondarchuk&apos;s
            Transfer of Training methodology. Answer questions about your event,
            experience, and goals &mdash; the system generates your program.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-500 group-hover:gap-3 transition-all">
          Get Started
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </Link>
    </div>
  );
}

/* ─── Draft State ───────────────────────────────────────────────────────── */

function DraftView({ draft }: { draft: DraftConfig }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/athlete/self-program/${draft.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  const updatedDate = new Date(draft.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-lg w-full space-y-4">
        <Link
          href={`/athlete/self-program/create?draft=${draft.id}`}
          className="card card-interactive p-8 text-center space-y-5 group block"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center mx-auto">
            <ClipboardList
              size={24}
              strokeWidth={1.75}
              className="text-primary-500"
              aria-hidden="true"
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold font-heading text-[var(--foreground)]">
              Continue Your Program Setup
            </h1>
            <p className="text-sm text-muted">
              {formatEventName(draft.event)} &middot; Last updated {updatedDate}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-500 group-hover:gap-3 transition-all">
            Continue
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </span>
        </Link>

        <div className="text-center">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={deleting}
            className="text-sm text-muted hover:text-danger-500 transition-colors disabled:opacity-50"
          >
            Start Over
          </button>
        </div>

        <ConfirmDialog
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleDelete}
          title="Delete Draft?"
          description="This will delete your in-progress program setup. You can start a new one any time."
          confirmLabel="Delete Draft"
          variant="danger"
          loading={deleting}
        />
      </div>
    </div>
  );
}

/* ─── Active State ──────────────────────────────────────────────────────── */

function ActiveView({
  config,
  eventMismatch,
}: {
  config: ActiveConfig;
  eventMismatch: boolean;
}) {
  const router = useRouter();
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const program = config.trainingProgram;
  const phases = program?.phases ?? [];
  const sessions = program?.sessions ?? [];

  // Current phase
  const currentPhase = phases[config.currentPhaseIndex] ?? phases[0] ?? null;
  const totalWeeks = phases.length > 0 ? phases[phases.length - 1].endWeek : 0;

  // Figure out current week
  const programStart = program ? new Date(program.startDate) : new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceStart = Math.floor(
    (Date.now() - programStart.getTime()) / msPerWeek
  );
  const currentWeek = Math.max(1, Math.min(weeksSinceStart + 1, totalWeeks));

  // Phase progress
  const phaseWeeksCurrent = currentPhase
    ? Math.max(0, currentWeek - currentPhase.startWeek + 1)
    : 0;
  const phaseTotalWeeks = currentPhase?.durationWeeks ?? 1;
  const phaseProgress = Math.min(
    100,
    Math.round((phaseWeeksCurrent / phaseTotalWeeks) * 100)
  );

  // Next upcoming session
  const upcomingSessions = sessions
    .filter((s) => s.status === "PLANNED" || s.status === "SCHEDULED")
    .filter((s) => s.scheduledDate)
    .sort(
      (a, b) =>
        new Date(a.scheduledDate!).getTime() -
        new Date(b.scheduledDate!).getTime()
    );
  const nextSession = upcomingSessions[0] ?? null;

  // Stats
  const completedSessions = sessions.filter(
    (s) => s.status === "COMPLETED"
  ).length;
  const totalThrows = completedSessions * 30; // estimate

  // Competition countdown
  type CompDate = { date: string; name: string; priority?: string };
  const compDates: CompDate[] = Array.isArray(config.competitionDates)
    ? (config.competitionDates as CompDate[])
    : [];
  const nextComp = compDates
    .map((c) => ({ ...c, dt: new Date(c.date) }))
    .filter((c) => c.dt.getTime() > Date.now())
    .sort((a, b) => a.dt.getTime() - b.dt.getTime())[0] ?? null;
  const daysUntilComp = nextComp
    ? Math.ceil(
        (nextComp.dt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await fetch(`/api/athlete/self-program/${config.id}/deactivate`, {
        method: "POST",
      });
      router.refresh();
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <ScrollProgressBar />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Self Program
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {formatEventName(config.event)} &middot;{" "}
            {formatSessionType(config.programType)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/athlete/self-program/create">
            <Button variant="outline" size="sm" leftIcon={<RefreshCw size={14} strokeWidth={1.75} aria-hidden="true" />}>
              Regenerate
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeactivate(true)}
            leftIcon={<XCircle size={14} strokeWidth={1.75} aria-hidden="true" />}
          >
            Deactivate
          </Button>
        </div>
      </div>

      {/* Event mismatch warning */}
      {eventMismatch && (
        <div className="flex items-start gap-3 rounded-xl border border-warning-300 dark:border-warning-500/40 bg-warning-50 dark:bg-warning-500/10 px-4 py-3">
          <AlertTriangle
            size={18}
            strokeWidth={1.75}
            className="text-warning-600 dark:text-warning-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="text-sm">
            <p className="font-semibold text-warning-800 dark:text-warning-300">
              Event Mismatch
            </p>
            <p className="text-warning-700 dark:text-warning-400 mt-0.5">
              Your active program is for {formatEventName(config.event)}, but
              that event is no longer in your profile. Consider regenerating your
              program.
            </p>
          </div>
        </div>
      )}

      {/* Main grid */}
      <StaggeredList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Current Phase */}
        <div className="card p-5 space-y-4 md:col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Current Phase
            </h2>
            {currentPhase && (
              <span
                className={cn(
                  "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border",
                  getPhaseColor(currentPhase.phase).bg,
                  getPhaseColor(currentPhase.phase).text,
                  getPhaseColor(currentPhase.phase).border
                )}
              >
                {currentPhase.phase}
              </span>
            )}
          </div>
          {currentPhase ? (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <p className="text-lg font-bold font-heading text-[var(--foreground)]">
                  Week {phaseWeeksCurrent} of {phaseTotalWeeks}
                </p>
                <p className="text-xs text-muted tabular-nums">
                  Program week {currentWeek} / {totalWeeks}
                </p>
              </div>
              <ProgressBar
                value={phaseProgress}
                variant="primary"
                size="md"
                showLabel
              />
            </div>
          ) : (
            <p className="text-sm text-muted">No phases configured.</p>
          )}
        </div>

        {/* Competition Countdown */}
        {nextComp && daysUntilComp !== null && (
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Next Competition
            </h2>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-heading text-primary-500 tabular-nums">
                <AnimatedNumber value={daysUntilComp} />
              </span>
              <span className="text-sm font-medium text-muted">days</span>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                {nextComp.name}
              </p>
              <p className="text-xs text-muted">
                {formatDate(nextComp.date)}
              </p>
            </div>
          </div>
        )}

        {/* Next Session */}
        {nextSession ? (
          <Link
            href="/athlete/training"
            className="card card-interactive p-5 space-y-3 block"
          >
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Next Session
            </h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center shrink-0">
                <Calendar
                  size={18}
                  strokeWidth={1.75}
                  className="text-white"
                  aria-hidden="true"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                  {nextSession.focusLabel}
                </p>
                <p className="text-xs text-muted">
                  {nextSession.scheduledDate
                    ? formatRelativeDate(nextSession.scheduledDate)
                    : `Week ${nextSession.weekNumber}`}
                  {nextSession.estimatedDuration &&
                    ` \u00B7 ~${nextSession.estimatedDuration}min`}
                </p>
              </div>
              <ChevronRight
                size={16}
                strokeWidth={1.75}
                className="text-muted shrink-0"
                aria-hidden="true"
              />
            </div>
            <p className="text-xs text-muted">
              {formatSessionType(nextSession.sessionType)}
            </p>
          </Link>
        ) : (
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Next Session
            </h2>
            <p className="text-sm text-muted">
              No upcoming sessions scheduled.
            </p>
          </div>
        )}

        {/* Program Stats */}
        <StatCard
          label="Completed Sessions"
          value={completedSessions}
          icon={<Target size={16} strokeWidth={1.75} aria-hidden="true" />}
          accent="primary"
        />
        <StatCard
          label="Est. Total Throws"
          value={totalThrows}
          icon={<Zap size={16} strokeWidth={1.75} aria-hidden="true" />}
          accent="success"
        />
        <StatCard
          label="Generations"
          value={config.generationCount}
          icon={<RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />}
          note="Programs generated"
        />
      </StaggeredList>

      {/* Phase Timeline */}
      {phases.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Phase Timeline
          </h2>
          <div className="card p-5">
            <div className="flex items-stretch gap-1 w-full overflow-x-auto custom-scrollbar">
              {phases.map((phase, i) => {
                const isCurrent = i === config.currentPhaseIndex;
                const isPast = i < config.currentPhaseIndex;
                const colors = getPhaseColor(phase.phase);

                return (
                  <div
                    key={phase.id}
                    className={cn(
                      "flex-1 min-w-[100px] rounded-lg border px-3 py-3 text-center transition-all",
                      isCurrent
                        ? cn(colors.bg, colors.border, "ring-2 ring-primary-500/30")
                        : isPast
                          ? "bg-surface-50 dark:bg-surface-800/50 border-surface-200 dark:border-surface-700 opacity-60"
                          : "bg-surface-50 dark:bg-surface-800/30 border-surface-200 dark:border-surface-700"
                    )}
                  >
                    <p
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        isCurrent ? colors.text : "text-muted"
                      )}
                    >
                      {phase.phase}
                    </p>
                    <p
                      className={cn(
                        "text-xs mt-1 tabular-nums",
                        isCurrent
                          ? "text-[var(--foreground)] font-semibold"
                          : "text-muted"
                      )}
                    >
                      {phase.durationWeeks}w
                    </p>
                    {isCurrent && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mx-auto mt-1.5" />
                    )}
                    {isPast && (
                      <Trophy
                        size={10}
                        strokeWidth={1.75}
                        className="text-muted mx-auto mt-1.5"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Deactivate Confirm */}
      <ConfirmDialog
        open={showDeactivate}
        onClose={() => setShowDeactivate(false)}
        onConfirm={handleDeactivate}
        title="Deactivate Program?"
        description="This will deactivate your current training program. Your data won't be deleted, but you'll need to generate a new program to continue training."
        confirmLabel="Deactivate"
        variant="danger"
        loading={deactivating}
      />
    </div>
  );
}

/* ─── Hub Router ────────────────────────────────────────────────────────── */

export function SelfProgramHub({
  state,
  config,
  draft,
  eventMismatch = false,
}: SelfProgramHubProps) {
  switch (state) {
    case "blocked":
      return <BlockedView />;
    case "empty":
      return <EmptyView />;
    case "draft":
      return draft ? <DraftView draft={draft} /> : <EmptyView />;
    case "active":
      return config ? (
        <ActiveView config={config} eventMismatch={eventMismatch} />
      ) : (
        <EmptyView />
      );
    default:
      return <EmptyView />;
  }
}
