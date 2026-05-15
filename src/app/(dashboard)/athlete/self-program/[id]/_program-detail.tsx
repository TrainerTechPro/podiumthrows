"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Dumbbell, RefreshCw, Sparkles, Target, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components";
import { csrfHeaders } from "@/lib/csrf-client";
import { ProgramSettings } from "./_program-settings";
import { PhaseTimeline } from "./_phase-timeline";
import type { ProgramPhase } from "./_week-expansion";

/* ─── Types ──────────────────────────────────────────────────────────────── */

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
  // Settings fields
  competitionLevel: string;
  yearsExperience: number;
  primaryGoal: string;
  preferredDays: string[];
  availableImplements: Array<{ weightKg: number; type?: string }>;
  competitionDates: Array<{ date: string; name: string; priority: string }> | null;
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

/* ─── Component ──────────────────────────────────────────────────────────── */

export function ProgramDetail({ config, program }: ProgramDetailProps) {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const { confirm, Dialog: ConfirmDialogPortal } = useConfirm();
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const phases = program.phases;
  const currentPhase = phases[config.currentPhaseIndex] ?? phases[0] ?? null;

  // All sessions across phases
  const allSessions = useMemo(() => phases.flatMap((p) => p.sessions), [phases]);

  // Volume stats
  const totalThrowsTarget = useMemo(
    () => allSessions.reduce((sum, s) => sum + s.totalThrowsTarget, 0),
    [allSessions]
  );
  const completedSessions = useMemo(
    () => allSessions.filter((s) => s.status === "COMPLETED").length,
    [allSessions]
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
      programStart.getTime() + (currentPhase.startWeek - 1) * msPerWeek
    );
    const phaseEndDate = new Date(programStart.getTime() + currentPhase.endWeek * msPerWeek);

    const now = Date.now();
    const phaseDuration = phaseEndDate.getTime() - phaseStartDate.getTime();
    if (phaseDuration <= 0) return false;

    const elapsed = now - phaseStartDate.getTime();
    const progress = elapsed / phaseDuration;

    return progress >= 0.8;
  }, [currentPhase, program.startDate]);

  const handleRegenerate = () => {
    confirm({
      title: "Regenerate program?",
      description:
        "This will replace your current program with a fresh one. Completed sessions are preserved in your history.",
      confirmLabel: "Regenerate",
      onConfirm: () => doRegenerate(),
    });
  };

  const doRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/athlete/self-program/${config.id}/generate`, {
        method: "POST",
        headers: csrfHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || "Failed to regenerate program";
        const details = data.validationErrors;
        throw new Error(details?.length ? `${msg}: ${details.join(", ")}` : msg);
      }
      success("Program Regenerated", "Your new program is ready.");
      router.refresh();
    } catch (err) {
      showError(
        "Regeneration failed",
        err instanceof Error ? err.message : "Please try again later."
      );
    } finally {
      setRegenerating(false);
    }
  };

  const handleGenerateNext = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/athlete/self-program/${config.id}/generate-next`, {
        method: "POST",
        headers: csrfHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate next phase");
      }
      success("Next phase generated", "Your program has been extended with a new training phase.");
      router.refresh();
    } catch (err) {
      showError(
        "Generation failed",
        err instanceof Error ? err.message : "Please try again later."
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
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
              {allSessions.every((s) => s.status === "COMPLETED" || s.status === "SKIPPED") ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                  Complete
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                  Active
                </span>
              )}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                Self-Generated
              </span>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating}
            leftIcon={
              <RefreshCw
                size={14}
                strokeWidth={1.75}
                className={regenerating ? "animate-spin" : ""}
                aria-hidden="true"
              />
            }
          >
            {regenerating ? "Regenerating..." : "Regenerate"}
          </Button>
        </div>
      </div>

      {/* ── Program Summary Cards ──────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Program Overview
        </h2>
        <StaggeredList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="card p-4 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Event</p>
            <p className="text-sm font-bold font-heading text-[var(--foreground)]">
              {formatEventName(config.event)}
            </p>
            <p className="text-xs text-muted capitalize">{config.gender.toLowerCase()}</p>
          </div>

          <div className="card p-4 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Schedule</p>
            <p className="text-sm font-bold font-heading text-[var(--foreground)]">
              {config.daysPerWeek} days/week
            </p>
            <p className="text-xs text-muted">
              {config.sessionsPerDay} session{config.sessionsPerDay !== 1 ? "s" : ""}/day
            </p>
          </div>

          <div className="card p-4 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Goal</p>
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
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Mode</p>
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
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Volume Stats</h2>
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

      {/* ── Top-level Program / Settings Tabs ─────────────────────────── */}
      <Tabs defaultTab="program">
        <TabList variant="underline">
          <TabTrigger id="program" variant="underline">
            Program
          </TabTrigger>
          <TabTrigger id="settings" variant="underline">
            Settings
          </TabTrigger>
        </TabList>

        {/* ── Program Tab ─────────────────────────────────────────────── */}
        <TabPanel id="program" className="mt-6 space-y-6">
          {/* Phase Timeline */}
          {phases.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Phase Timeline
              </h2>
              <PhaseTimeline
                phases={phases}
                programStartDate={program.startDate}
                configId={config.id}
              />
            </section>
          )}

          {/* Generate Next Phase */}
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
                    You&apos;re 80%+ through your current phase. Generate the next mesocycle to keep
                    your training on track.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleGenerateNext}
                  loading={generating}
                  leftIcon={
                    generating ? undefined : <Zap size={16} strokeWidth={1.75} aria-hidden="true" />
                  }
                >
                  {generating ? "Generating..." : "Generate Next Phase"}
                </Button>
              </div>
            </section>
          )}
        </TabPanel>

        {/* ── Settings Tab ────────────────────────────────────────────── */}
        <TabPanel id="settings" className="mt-6">
          <ProgramSettings config={config} />
        </TabPanel>
      </Tabs>
      <ConfirmDialogPortal />
    </div>
  );
}
