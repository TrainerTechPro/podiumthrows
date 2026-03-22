"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  SkipForward,
  Target,
  Timer,
  Flame,
  RotateCcw,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";

// ── Types ──────────────────────────────────────────────────────────────

interface ThrowPrescription {
  implement: string;
  implementKg: number;
  category: string;
  drillType: string;
  sets: number;
  repsPerSet: number;
  restSeconds: number;
  notes?: string;
}

interface StrengthPrescription {
  exerciseId?: string;
  exerciseName: string;
  classification: string;
  sets: number;
  reps: number;
  intensityPercent?: number;
  loadKg?: number;
  restSeconds: number;
  notes?: string;
}

interface WarmupPrescription {
  name: string;
  duration?: number;
  notes?: string;
}

interface ProgramSessionData {
  id: string;
  weekNumber: number;
  dayOfWeek: number;
  dayType: string;
  sessionType: string;
  focusLabel: string;
  throwsPrescription: string;
  strengthPrescription: string | null;
  warmupPrescription: string | null;
  totalThrowsTarget: number;
  estimatedDuration: number | null;
  status: string;
  completedAt: string | null;
  phase: {
    phase: string;
    phaseOrder: number;
    startWeek: number;
    endWeek: number;
  };
  program: {
    startDate: string;
    event: string;
    gender: string;
    daysPerWeek: number;
  };
}

interface SessionDetailProps {
  configId: string;
  session: ProgramSessionData;
  scheduledDate: string | null;
  prevSessionId: string | null;
  nextSessionId: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const SESSION_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  THROWS_ONLY: { label: "Throws", color: "text-blue-500" },
  THROWS_LIFT: { label: "Throws + Lifting", color: "text-primary-500" },
  LIFT_ONLY: { label: "Lifting", color: "text-emerald-500" },
  COMPETITION_SIM: { label: "Competition Sim", color: "text-red-500" },
  RECOVERY: { label: "Recovery", color: "text-teal-500" },
};

const PHASE_COLORS: Record<string, string> = {
  ACCUMULATION: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  TRANSMUTATION: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  REALIZATION: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  COMPETITION: "bg-red-500/10 text-red-500 border-red-500/20",
};

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  PLANNED: { label: "Planned", color: "bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300" },
  SCHEDULED: { label: "Scheduled", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  IN_PROGRESS: { label: "In Progress", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
  COMPLETED: { label: "Completed", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" },
  SKIPPED: { label: "Skipped", color: "bg-surface-200 dark:bg-surface-700 text-surface-500 line-through" },
};

const DRILL_TYPE_LABELS: Record<string, string> = {
  FULL_THROW: "Full Throw",
  STANDING: "Standing Throw",
  HALF_TURN: "Half Turn",
  POWER_POSITION: "Power Position",
  GLIDE: "Glide",
  SPIN: "Spin",
  WIND_DRILL: "Wind Drill",
  RELEASE_DRILL: "Release Drill",
  BLOCK_DRILL: "Block Drill",
};

const CLASSIFICATION_LABELS: Record<string, { label: string; color: string }> = {
  CE: { label: "CE", color: "bg-red-500/10 text-red-500" },
  SDE: { label: "SDE", color: "bg-orange-500/10 text-orange-500" },
  SPE: { label: "SPE", color: "bg-amber-500/10 text-amber-500" },
  GPE: { label: "GPE", color: "bg-blue-500/10 text-blue-500" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatRestTime(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  return `${seconds}s`;
}

// ── Main Component ─────────────────────────────────────────────────────

export function SessionDetail({
  configId,
  session,
  scheduledDate,
  prevSessionId,
  nextSessionId,
}: SessionDetailProps) {
  const _router = useRouter();
  const { success, error: toastError } = useToast();
  const [status, setStatus] = useState(session.status);
  const [skipping, setSkipping] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  const throws: ThrowPrescription[] = JSON.parse(session.throwsPrescription || "[]");
  const strength: StrengthPrescription[] = JSON.parse(session.strengthPrescription || "[]");
  const warmup: WarmupPrescription[] = JSON.parse(session.warmupPrescription || "[]");

  const sessionTypeInfo = SESSION_TYPE_LABELS[session.sessionType] ?? {
    label: session.sessionType,
    color: "text-muted",
  };
  const phaseColor = PHASE_COLORS[session.phase.phase] ?? PHASE_COLORS.ACCUMULATION;
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.PLANNED;

  const totalThrows = throws.reduce((sum, t) => sum + t.sets * t.repsPerSet, 0);

  // ── Actions ────────────────────────────────────────────────────────

  async function handleSkip() {
    setSkipping(true);
    try {
      const res = await fetch(`/api/athlete/self-program/${configId}/session/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ status: "SKIPPED" }),
      });
      if (res.ok) {
        setStatus("SKIPPED");
        success("Session skipped");
      } else {
        toastError("Error", "Failed to skip session");
      }
    } catch {
      toastError("Error", "Something went wrong");
    } finally {
      setSkipping(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <ScrollProgressBar />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <Link
            href={`/athlete/self-program/${configId}`}
            className="flex items-center gap-1.5 text-muted hover:text-[var(--foreground)] transition-colors text-sm"
          >
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            Back to Program
          </Link>

          {/* Prev / Next navigation */}
          <div className="flex items-center gap-1">
            {prevSessionId ? (
              <Link
                href={`/athlete/self-program/${configId}/session/${prevSessionId}`}
                className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                aria-label="Previous session"
              >
                <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            ) : (
              <span className="p-2 opacity-30">
                <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
              </span>
            )}
            {nextSessionId ? (
              <Link
                href={`/athlete/self-program/${configId}/session/${nextSessionId}`}
                className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                aria-label="Next session"
              >
                <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            ) : (
              <span className="p-2 opacity-30">
                <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
              </span>
            )}
          </div>
        </div>

        <h1 className="text-xl font-heading text-[var(--foreground)]">
          {DAY_NAMES[session.dayOfWeek]} — {session.focusLabel}
        </h1>

        <div className="flex items-center flex-wrap gap-2 mt-2">
          <span className={`text-xs px-2.5 py-0.5 rounded-full border ${phaseColor}`}>
            {session.phase.phase}
          </span>
          <span className={`text-xs font-medium ${sessionTypeInfo.color}`}>
            {sessionTypeInfo.label}
          </span>
          <span className={`text-xs px-2.5 py-0.5 rounded-full ${statusStyle.color}`}>
            {statusStyle.label}
          </span>
        </div>

        {scheduledDate && (
          <p className="text-sm text-muted mt-1.5 flex items-center gap-1.5">
            <Calendar size={14} strokeWidth={1.75} aria-hidden="true" />
            {formatDate(scheduledDate)}
          </p>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-3 text-center">
          <Target size={16} strokeWidth={1.75} className="mx-auto text-primary-500 mb-1" aria-hidden="true" />
          <div className="text-lg font-semibold tabular-nums">
            <AnimatedNumber value={totalThrows} />
          </div>
          <div className="text-xs text-muted">throws</div>
        </div>
        <div className="card p-3 text-center">
          <Dumbbell size={16} strokeWidth={1.75} className="mx-auto text-emerald-500 mb-1" aria-hidden="true" />
          <div className="text-lg font-semibold tabular-nums">
            <AnimatedNumber value={strength.length} />
          </div>
          <div className="text-xs text-muted">exercises</div>
        </div>
        <div className="card p-3 text-center">
          <Clock size={16} strokeWidth={1.75} className="mx-auto text-blue-500 mb-1" aria-hidden="true" />
          <div className="text-lg font-semibold tabular-nums">
            {session.estimatedDuration ? <AnimatedNumber value={session.estimatedDuration} /> : "—"}
          </div>
          <div className="text-xs text-muted">min</div>
        </div>
      </div>

      {/* Warmup */}
      {warmup.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Flame size={14} strokeWidth={1.75} aria-hidden="true" />
            Warmup
          </h2>
          <div className="card divide-y divide-[var(--card-border)]">
            {warmup.map((w, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium">{w.name}</span>
                <div className="flex items-center gap-3 text-xs text-muted">
                  {w.duration && (
                    <span className="flex items-center gap-1">
                      <Timer size={12} strokeWidth={1.75} aria-hidden="true" />
                      {w.duration}m
                    </span>
                  )}
                  {w.notes && <span className="italic">{w.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Throws Prescription */}
      {throws.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Target size={14} strokeWidth={1.75} aria-hidden="true" />
            Throws
          </h2>
          <div className="space-y-3">
            {throws.map((t, i) => {
              const classInfo = CLASSIFICATION_LABELS[t.category] ?? {
                label: t.category,
                color: "bg-surface-200 text-surface-600",
              };
              return (
                <div key={i} className="card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm">
                          {t.implement}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${classInfo.color}`}>
                          {classInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted">
                        {DRILL_TYPE_LABELS[t.drillType] ?? t.drillType}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums">
                        {t.sets * t.repsPerSet} throws
                      </div>
                      <div className="text-xs text-muted tabular-nums">
                        {t.sets} &times; {t.repsPerSet}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Timer size={11} strokeWidth={1.75} aria-hidden="true" />
                      {formatRestTime(t.restSeconds)} rest
                    </span>
                    {t.notes && <span className="italic">{t.notes}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Strength Prescription */}
      {strength.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Dumbbell size={14} strokeWidth={1.75} aria-hidden="true" />
            Strength
          </h2>
          <div className="card divide-y divide-[var(--card-border)]">
            {strength.map((s, i) => {
              const classInfo = CLASSIFICATION_LABELS[s.classification] ?? {
                label: s.classification,
                color: "bg-surface-200 text-surface-600",
              };
              return (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium">{s.exerciseName}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${classInfo.color}`}>
                          {classInfo.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <span className="font-semibold tabular-nums">
                        {s.sets} &times; {s.reps}
                      </span>
                      {s.loadKg != null && (
                        <span className="text-muted ml-1.5 tabular-nums">@ {s.loadKg}kg</span>
                      )}
                      {s.intensityPercent != null && !s.loadKg && (
                        <span className="text-muted ml-1.5 tabular-nums">@ {s.intensityPercent}%</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted mt-1">
                    <span className="flex items-center gap-1">
                      <Timer size={11} strokeWidth={1.75} aria-hidden="true" />
                      {formatRestTime(s.restSeconds)} rest
                    </span>
                    {s.notes && <span className="italic">{s.notes}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Week / Day Info */}
      <section className="mb-8">
        <div className="card p-4 text-sm text-muted">
          <div className="flex justify-between">
            <span>Week {session.weekNumber} of phase</span>
            <span>Day type: {session.dayType}</span>
          </div>
        </div>
      </section>

      {/* Actions */}
      {status !== "COMPLETED" && status !== "SKIPPED" && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2">Actions</h2>

          <button
            type="button"
            disabled={skipping}
            onClick={() => setShowSkipConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3 card hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors rounded-xl text-left"
          >
            <SkipForward size={18} strokeWidth={1.75} className="text-amber-500" aria-hidden="true" />
            <div>
              <div className="text-sm font-medium">Skip Session</div>
              <div className="text-xs text-muted">Mark as skipped and move on</div>
            </div>
          </button>
          <ConfirmDialog
            open={showSkipConfirm}
            onClose={() => setShowSkipConfirm(false)}
            title="Skip this session?"
            description="This session will be marked as skipped. You can't undo this."
            onConfirm={handleSkip}
            variant="danger"
            confirmLabel="Skip"
          />

          <button
            type="button"
            onClick={() => {
              // TODO: Implement reschedule modal
              toastError("Coming Soon", "Rescheduling will be available in the next update");
            }}
            className="w-full flex items-center gap-3 px-4 py-3 card hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors rounded-xl text-left"
          >
            <RotateCcw size={18} strokeWidth={1.75} className="text-blue-500" aria-hidden="true" />
            <div>
              <div className="text-sm font-medium">Reschedule</div>
              <div className="text-xs text-muted">Move this session to a different day</div>
            </div>
          </button>
        </section>
      )}

      {status === "COMPLETED" && (
        <div className="card p-4 bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-center">
          <CheckCircle2 size={24} strokeWidth={1.75} className="text-emerald-500 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Session Completed</p>
          {session.completedAt && (
            <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
              {formatDate(session.completedAt)}
            </p>
          )}
        </div>
      )}

      {status === "SKIPPED" && (
        <div className="card p-4 bg-surface-100 dark:bg-surface-800 text-center">
          <SkipForward size={24} strokeWidth={1.75} className="text-muted mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm font-medium text-muted">Session Skipped</p>
        </div>
      )}
    </div>
  );
}
