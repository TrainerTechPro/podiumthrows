"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import {
  Cpu,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowDown,
  Loader2,
  Zap,
  Target,
  Dumbbell,
  TrendingUp,
} from "lucide-react";
import type { ArchitectAnalysis } from "@/lib/bondarchuk/architect-engine";

/* ─── Types ──────────────────────────────────────────────────────────── */

type AthleteCard = {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  events: string[];
  pr: number | null;
  prEvent: string;
  dateOfBirth: string | null;
};

type Props = {
  athletes: AthleteCard[];
};

type TrainingPhase = "ACCUMULATION" | "CONVERSION" | "REALIZATION";

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

const DAYS_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 70, label: "70 days" },
  { value: 120, label: "120 days" },
];

const PHASE_OPTIONS: { value: TrainingPhase; label: string }[] = [
  { value: "ACCUMULATION", label: "Accumulation" },
  { value: "CONVERSION", label: "Conversion" },
  { value: "REALIZATION", label: "Realization" },
];

function getAge(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
  ) {
    age--;
  }
  return age;
}

/* ─── Main Component ─────────────────────────────────────────────────── */

export function ArchitectClient({ athletes }: Props) {
  const toast = useToast();

  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [daysToChampionship, setDaysToChampionship] = useState(70);
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase>("ACCUMULATION");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ArchitectAnalysis | null>(null);

  const selectedAthlete = athletes.find((a) => a.id === selectedAthleteId);

  const runAnalysis = useCallback(async () => {
    if (!selectedAthleteId) {
      toast.error("Select an athlete first");
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const res = await fetch("/api/coach/architect/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: selectedAthleteId,
          daysToChampionship,
          trainingPhase,
        }),
      });

      const payload = await res.json();

      if (!res.ok || !payload.success) {
        toast.error(payload.error || `Analysis failed (${res.status})`);
        return;
      }

      setAnalysis(payload.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error — try again");
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedAthleteId, daysToChampionship, trainingPhase, toast]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-500/10">
          <Cpu size={22} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-[var(--foreground)]">
            Bondarchuk Architect
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Volume IV analysis engine — athlete profiling, deficit diagnosis, session structure
          </p>
        </div>
      </div>

      {/* Step 1: Select Athlete */}
      <StepSection step={1} title="Select athlete">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {athletes.map((a) => {
            const age = getAge(a.dateOfBirth);
            const isSelected = selectedAthleteId === a.id;

            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setSelectedAthleteId(a.id);
                  setAnalysis(null);
                }}
                className={cn(
                  "text-left rounded-lg border p-4 transition-all duration-150",
                  "hover:border-primary-500/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
                  isSelected
                    ? "border-primary-500 bg-primary-500/8 shadow-sm shadow-primary-500/10"
                    : "border-[var(--card-border)] bg-[var(--card-bg)]"
                )}
              >
                <div className="font-heading font-semibold text-[var(--foreground)]">
                  {a.firstName} {a.lastName}
                </div>
                <div className="text-sm text-primary-500 mt-0.5">
                  {EVENT_LABELS[a.prEvent] ?? a.prEvent}
                  {a.gender ? ` · ${a.gender === "MALE" ? "Male" : "Female"}` : ""}
                  {age ? ` · ${age}yo` : ""}
                </div>
                {a.pr != null && (
                  <div className="text-sm text-[var(--muted)] mt-0.5">PR: {a.pr.toFixed(2)}m</div>
                )}
              </button>
            );
          })}

          {athletes.length === 0 && (
            <div className="col-span-2 text-center py-8 text-[var(--muted)]">
              No athletes on your roster. Add athletes from the Roster page first.
            </div>
          )}
        </div>
      </StepSection>

      {/* Step 2: Training Context */}
      <StepSection step={2} title="Training context">
        <div className="space-y-4">
          {/* Days to Championship */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-[var(--muted)] min-w-[160px]">Days to championship:</span>
            <div className="flex gap-2">
              {DAYS_OPTIONS.map((opt) => (
                <PillButton
                  key={opt.value}
                  label={opt.label}
                  isActive={daysToChampionship === opt.value}
                  onClick={() => {
                    setDaysToChampionship(opt.value);
                    setAnalysis(null);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Training Phase */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-[var(--muted)] min-w-[160px]">Training phase:</span>
            <div className="flex gap-2">
              {PHASE_OPTIONS.map((opt) => (
                <PillButton
                  key={opt.value}
                  label={opt.label}
                  isActive={trainingPhase === opt.value}
                  onClick={() => {
                    setTrainingPhase(opt.value);
                    setAnalysis(null);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </StepSection>

      {/* Run Analysis Button */}
      <button
        type="button"
        onClick={runAnalysis}
        disabled={!selectedAthleteId || isAnalyzing}
        className={cn(
          "w-full py-3.5 rounded-lg font-heading font-semibold text-sm tracking-wide",
          "transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          selectedAthleteId && !isAnalyzing
            ? "bg-primary-500 text-surface-950 hover:bg-primary-400 active:scale-[0.98]"
            : "bg-[var(--card-bg)] text-[var(--muted)] border border-[var(--card-border)]"
        )}
      >
        {isAnalyzing ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" />
            Analyzing...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            Run Bondarchuk analysis
            <ChevronRight size={16} />
          </span>
        )}
      </button>

      {/* Results */}
      {analysis && (
        <AnalysisResults
          analysis={analysis}
          athleteName={
            selectedAthlete ? `${selectedAthlete.firstName} ${selectedAthlete.lastName}` : ""
          }
        />
      )}
    </div>
  );
}

/* ─── Sub-Components ─────────────────────────────────────────────────── */

function StepSection({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-500/15 text-primary-500 text-xs font-bold font-mono">
          {step}
        </span>
        <span className="font-heading font-semibold text-[var(--foreground)]">{title}</span>
      </div>
      {children}
    </div>
  );
}

function PillButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
        isActive
          ? "bg-primary-500 text-surface-950"
          : "bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] hover:border-primary-500/40"
      )}
    >
      {label}
    </button>
  );
}

/* ─── Results Panel ──────────────────────────────────────────────────── */

function AnalysisResults({
  analysis,
  athleteName,
}: {
  analysis: ArchitectAnalysis;
  athleteName: string;
}) {
  return (
    <div className="space-y-4 animate-fade-slide-in">
      {/* Phase Conflicts */}
      {analysis.context.phaseConflicts.length > 0 && (
        <div className="space-y-2">
          {analysis.context.phaseConflicts.map((c, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3 p-3.5 rounded-lg border",
                c.type === "error"
                  ? "bg-red-500/8 border-red-500/30 text-red-400"
                  : "bg-amber-500/8 border-amber-500/30 text-amber-400"
              )}
            >
              {c.type === "error" ? (
                <AlertCircle size={18} strokeWidth={1.75} className="shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={18} strokeWidth={1.75} className="shrink-0 mt-0.5" />
              )}
              <span className="text-sm">{c.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Athlete Profile Card */}
      <ResultCard
        icon={<Target size={18} strokeWidth={1.75} className="text-primary-500" />}
        title="Athlete Profile"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <DataPair label="Athlete" value={athleteName} />
          <DataPair
            label="Event"
            value={EVENT_LABELS[analysis.athlete.event] ?? analysis.athlete.event}
          />
          <DataPair
            label="PR"
            value={analysis.athlete.pr ? `${analysis.athlete.pr.toFixed(2)}m` : "—"}
          />
          <DataPair label="Distance Band" value={analysis.athlete.distanceBand.label} />
        </div>
      </ResultCard>

      {/* Deficit Analysis */}
      <ResultCard
        icon={<TrendingUp size={18} strokeWidth={1.75} className="text-primary-500" />}
        title="Deficit Analysis"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <DeficitBadge type={analysis.deficitProfile.type} />
            <span className="text-sm font-medium text-[var(--foreground)]">
              {analysis.deficitProfile.label}
            </span>
          </div>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            {analysis.deficitProfile.description}
          </p>

          {analysis.deficitProfile.strengthBenchmarks.length > 0 && (
            <div className="mt-3 space-y-2">
              {analysis.deficitProfile.strengthBenchmarks.map((b) => (
                <div
                  key={b.lift}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-50 dark:bg-surface-800/30"
                >
                  <span className="text-sm text-[var(--foreground)]">{b.lift}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-[var(--muted)]">
                      {b.current != null ? `${b.current}kg` : "—"} / {b.standard}
                      {b.unit}
                    </span>
                    <BenchmarkStatus status={b.status} deficit={b.deficit} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ResultCard>

      {/* Method Selection */}
      <ResultCard
        icon={<Zap size={18} strokeWidth={1.75} className="text-primary-500" />}
        title="Method Selection"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                analysis.method.selected === "COMPLEX"
                  ? "bg-green-500/15 text-green-400"
                  : "bg-amber-500/15 text-amber-400"
              )}
            >
              {analysis.method.selected}
            </span>
          </div>
          <p className="text-sm text-[var(--muted)] leading-relaxed">{analysis.method.rationale}</p>
        </div>
      </ResultCard>

      {/* Session Structure */}
      <ResultCard
        icon={<Dumbbell size={18} strokeWidth={1.75} className="text-primary-500" />}
        title="Session Structure"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {analysis.sessionStructure.template}
            </span>
          </div>
          <p className="text-sm text-[var(--muted)]">{analysis.sessionStructure.description}</p>

          {/* Blocks */}
          <div className="space-y-3">
            {analysis.sessionStructure.blocks.map((block, i) => (
              <div key={i}>
                {i > 0 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown size={14} className="text-[var(--muted)] opacity-40" />
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-lg border p-4",
                    block.type === "THROWING"
                      ? "border-primary-500/30 bg-primary-500/5"
                      : "border-[var(--card-border)] bg-surface-50 dark:bg-surface-800/20"
                  )}
                >
                  <div className="text-sm font-semibold text-[var(--foreground)] mb-2">
                    {block.label}
                  </div>

                  {block.implements && block.implements.length > 0 && (
                    <div className="space-y-1.5">
                      {block.implements.map((impl, j) => (
                        <div key={j} className="flex items-center justify-between text-sm">
                          <span className="text-[var(--foreground)]">
                            <span className="font-mono font-medium">{impl.weight}</span>
                            <span className="text-[var(--muted)] ml-1.5">({impl.role})</span>
                          </span>
                          <span className="text-[var(--muted)] font-mono text-xs">
                            {impl.throwCount} throws · {impl.intensityRange}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {block.exercises && block.exercises.length > 0 && (
                    <div className="space-y-1">
                      {block.exercises.map((ex, j) => (
                        <div key={j} className="text-sm text-[var(--muted)]">
                          {ex}
                        </div>
                      ))}
                    </div>
                  )}

                  {block.notes && (
                    <div className="text-xs text-[var(--muted)] mt-2 italic">{block.notes}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Session Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--card-border)]">
            <DataPair label="Total throws" value={analysis.sessionStructure.totalThrows} />
            <DataPair label="Weekly volume" value={analysis.sessionStructure.weeklyVolume} />
            <DataPair
              label="Rest (throws)"
              value={analysis.sessionStructure.restIntervals.throws}
            />
          </div>
        </div>
      </ResultCard>

      {/* Weekly Distribution */}
      <ResultCard
        icon={<Target size={18} strokeWidth={1.75} className="text-primary-500" />}
        title="Weekly Distribution"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <DataPair label="CE (Competitive)" value={analysis.weeklyDistribution.ce} />
          <DataPair label="SDE (Special Dev)" value={analysis.weeklyDistribution.sde} />
          <DataPair label="SPE (Special Prep)" value={analysis.weeklyDistribution.spe} />
          <DataPair label="GPE (General)" value={analysis.weeklyDistribution.gpe} />
        </div>
      </ResultCard>
    </div>
  );
}

function ResultCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <span className="font-heading font-semibold text-sm text-[var(--foreground)]">{title}</span>
      </div>
      {children}
    </div>
  );
}

function DataPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--muted)] uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm font-medium text-[var(--foreground)] font-mono">{value}</div>
    </div>
  );
}

function DeficitBadge({ type }: { type: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    "force-dominant": { bg: "bg-amber-500/15", text: "text-amber-400", label: "Force-dominant" },
    "speed-dominant": { bg: "bg-blue-500/15", text: "text-blue-400", label: "Speed-dominant" },
    "under-developed": { bg: "bg-red-500/15", text: "text-red-400", label: "Under-developed" },
    balanced: { bg: "bg-green-500/15", text: "text-green-400", label: "Balanced" },
  };

  const c = config[type] ?? config.balanced;

  return (
    <span
      className={cn(
        "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider",
        c.bg,
        c.text
      )}
    >
      {c.label}
    </span>
  );
}

function BenchmarkStatus({ status, deficit }: { status: string; deficit: number | null }) {
  if (status === "unknown") {
    return <span className="text-xs text-[var(--muted)]">—</span>;
  }

  if (status === "above") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-400">
        <CheckCircle2 size={14} strokeWidth={1.75} />
        Above
      </span>
    );
  }

  if (status === "at") {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-400">
        <CheckCircle2 size={14} strokeWidth={1.75} />
        At standard
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-red-400">
      <XCircle size={14} strokeWidth={1.75} />
      {deficit != null ? `-${deficit}%` : "Below"}
    </span>
  );
}
