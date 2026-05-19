"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarPlus, Lock, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";
import { reportApiError } from "@/lib/form-errors";
import { logger } from "@/lib/logger";
import { NumberFlow } from "@/components/ui/NumberFlow";
import { Button } from "@/components/ui/Button";
import { SlideToConfirm } from "@/components/ui/SlideToConfirm";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components";

/* ─── Types ──────────────────────────────────────────────────────────────── */

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
  competitionLevel: string;
  yearsExperience: number;
  primaryGoal: string;
  preferredDays: string[];
  availableImplements: Array<{ weightKg: number; type?: string }>;
  competitionDates: Array<{ date: string; name: string; priority: string }> | null;
}

interface CompetitionDate {
  date: string;
  name: string;
  priority: string;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const DAYS = [
  { value: "MONDAY", label: "Mon" },
  { value: "TUESDAY", label: "Tue" },
  { value: "WEDNESDAY", label: "Wed" },
  { value: "THURSDAY", label: "Thu" },
  { value: "FRIDAY", label: "Fri" },
  { value: "SATURDAY", label: "Sat" },
  { value: "SUNDAY", label: "Sun" },
] as const;

const DAYS_PER_WEEK_OPTIONS = [2, 3, 4, 5] as const;

const PROGRAM_TYPES = [
  { value: "THROWS_ONLY", label: "Throws Only", description: "Focused throwing sessions" },
  {
    value: "THROWS_AND_LIFTING",
    label: "Throws + Lifting",
    description: "Throws with strength blocks",
  },
] as const;

const PRIMARY_GOALS = [
  { value: "DISTANCE", label: "Distance", description: "Maximize throw distance" },
  { value: "TECHNIQUE", label: "Technique", description: "Refine movement patterns" },
  { value: "CONSISTENCY", label: "Consistency", description: "Tighten groupings" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "A_MEET", label: "A Meet" },
  { value: "B_MEET", label: "B Meet" },
  { value: "C_MEET", label: "C Meet" },
] as const;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCompetitionLevel(level: string): string {
  return level
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function ProgramSettings({ config }: { config: SelfProgramConfig }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, Dialog: ConfirmDialogPortal } = useConfirm();

  // Local form state
  const [form, setForm] = useState({
    daysPerWeek: config.daysPerWeek,
    sessionsPerDay: config.sessionsPerDay,
    preferredDays: [...config.preferredDays],
    programType: config.programType,
    primaryGoal: config.primaryGoal,
    availableImplements: [...config.availableImplements],
    competitionDates: config.competitionDates
      ? config.competitionDates.map((cd) => ({ ...cd }))
      : ([] as CompetitionDate[]),
  });

  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(<K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  function toggleDay(day: string) {
    const current = form.preferredDays;
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    update("preferredDays", next);
  }

  function addCompetitionDate() {
    update("competitionDates", [
      ...form.competitionDates,
      { date: "", name: "", priority: "B_MEET" },
    ]);
  }

  function removeCompetitionDate(index: number) {
    update(
      "competitionDates",
      form.competitionDates.filter((_, i) => i !== index)
    );
  }

  function updateCompetitionDate(index: number, field: keyof CompetitionDate, value: string) {
    const updated = form.competitionDates.map((cd, i) =>
      i === index ? { ...cd, [field]: value } : cd
    );
    update("competitionDates", updated);
  }

  // Mismatch warning for preferred days vs daysPerWeek
  const daysMismatch =
    form.preferredDays.length > 0 && form.preferredDays.length !== form.daysPerWeek;

  /* ─── Regeneration Flow ───────────────────────────────────────────────── */

  const regenerate = async () => {
    setRegenerating(true);
    setError(null);
    try {
      // 1. Save settings
      const putRes = await fetch(`/api/athlete/self-program/${config.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          programType: form.programType,
          daysPerWeek: form.daysPerWeek,
          sessionsPerDay: form.sessionsPerDay,
          preferredDays: form.preferredDays,
          primaryGoal: form.primaryGoal,
          availableImplements: form.availableImplements,
          competitionDates: form.competitionDates,
        }),
      });
      if (!putRes.ok) {
        const data = await putRes.json().catch(() => null);
        const info = reportApiError({ res: putRes, payload: data }, toast, {
          onRetry: regenerate,
          titleOverride: "Couldn't save settings",
          silent: true,
        });
        setError(info.message);
        return;
      }

      // 2. Regenerate program
      const genRes = await fetch(`/api/athlete/self-program/${config.id}/generate`, {
        method: "POST",
        headers: csrfHeaders(),
      });
      if (!genRes.ok) {
        const data = await genRes.json().catch(() => null);
        const info = reportApiError({ res: genRes, payload: data }, toast, {
          onRetry: regenerate,
          titleOverride: "Couldn't regenerate program",
          silent: true,
        });
        const details = data?.validationErrors;
        setError(details?.length ? `${info.message} (${details.join(", ")})` : info.message);
        return;
      }

      toast.success("Program Regenerated", "Your new program is ready.");
      router.refresh();
    } catch (err) {
      logger.error("program regenerate failed", {
        context: "athlete/self-program/program-settings",
        error: err,
      });
      const info = reportApiError({ err }, toast, { onRetry: regenerate, silent: true });
      setError(info.message);
    } finally {
      setRegenerating(false);
    }
  };

  const handleDesktopRegenerate = () => {
    confirm({
      title: "Regenerate program?",
      description:
        "This will replace your current program. Completed sessions are preserved in your history.",
      confirmLabel: "Regenerate",
      onConfirm: () => regenerate(),
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      {/* ── 1. Read-Only Summary Card ──────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Lock size={14} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Program Identity
          </h2>
        </div>
        <div className="card p-5 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-micro font-medium uppercase tracking-wider text-muted">Event</p>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {formatEventName(config.event)}
              </p>
            </div>
            <div>
              <p className="text-micro font-medium uppercase tracking-wider text-muted">Gender</p>
              <p className="text-sm font-semibold text-[var(--foreground)] capitalize">
                {config.gender.toLowerCase()}
              </p>
            </div>
            <div>
              <p className="text-micro font-medium uppercase tracking-wider text-muted">
                Competition Level
              </p>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {formatCompetitionLevel(config.competitionLevel)}
              </p>
            </div>
            <div>
              <p className="text-micro font-medium uppercase tracking-wider text-muted">
                Current PR
              </p>
              <p className="text-sm font-semibold text-[var(--foreground)] tabular-nums">
                {config.currentPR.toFixed(2)}m
              </p>
            </div>
            <div>
              <p className="text-micro font-medium uppercase tracking-wider text-muted">
                Years Experience
              </p>
              <p className="text-sm font-semibold text-[var(--foreground)] tabular-nums">
                {config.yearsExperience}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted pt-1 border-t border-[var(--card-border)]">
            To change these, create a new program.
          </p>
        </div>
      </section>

      {/* ── 2. Schedule Section ────────────────────────────────────────── */}
      <section className="space-y-5">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Schedule</h2>

        {/* Days per week */}
        <div>
          <p className="text-sm font-medium text-[var(--foreground)] mb-2">
            Days per week:{" "}
            <NumberFlow
              value={form.daysPerWeek}
              className="font-semibold text-primary-600 dark:text-primary-400"
            />
          </p>
          <div className="flex gap-2">
            {DAYS_PER_WEEK_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => update("daysPerWeek", n)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                  form.daysPerWeek === n
                    ? "bg-primary-500 text-white shadow-md"
                    : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Sessions per day */}
        <div>
          <p className="text-sm font-medium text-[var(--foreground)] mb-2">Sessions per day</p>
          <div className="flex rounded-xl border border-[var(--card-border)] overflow-hidden">
            {[1, 2].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => update("sessionsPerDay", n)}
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium transition-colors",
                  form.sessionsPerDay === n
                    ? "bg-primary-500 text-white"
                    : "bg-transparent text-surface-700 dark:text-surface-300 hover:bg-[var(--muted-bg)]"
                )}
              >
                {n === 1 ? "Single Session" : "Double Sessions"}
              </button>
            ))}
          </div>
          {form.sessionsPerDay === 2 && (
            <p className="text-caption text-primary-700 dark:text-primary-400 mt-1">
              Double sessions split throws and strength into separate AM/PM sessions
            </p>
          )}
        </div>

        {/* Preferred days */}
        <div>
          <p className="text-sm font-medium text-[var(--foreground)] mb-2">
            Preferred training days
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((day) => {
              const isSelected = form.preferredDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    "min-h-[44px] rounded-lg text-xs font-semibold transition-colors",
                    isSelected
                      ? "bg-primary-500 text-white shadow-sm"
                      : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700"
                  )}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          {daysMismatch && (
            <div className="flex items-start gap-2 mt-2 p-2.5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
              <AlertTriangle
                size={14}
                strokeWidth={1.75}
                className="text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="text-xs text-primary-800 dark:text-primary-300">
                You selected {form.preferredDays.length} day
                {form.preferredDays.length !== 1 ? "s" : ""} but your schedule is set to{" "}
                {form.daysPerWeek} days/week.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── 3. Program Type ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Program Type</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROGRAM_TYPES.map((pt) => (
            <button
              key={pt.value}
              type="button"
              onClick={() => update("programType", pt.value)}
              className={cn(
                "card p-4 text-left transition-colors",
                form.programType === pt.value
                  ? "ring-2 ring-primary-500 bg-primary-50/50 dark:bg-primary-950/20"
                  : "hover:bg-surface-50 dark:hover:bg-surface-800/50"
              )}
            >
              <p className="text-sm font-semibold text-[var(--foreground)]">{pt.label}</p>
              <p className="text-xs text-muted mt-0.5">{pt.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── 4. Primary Goal ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Primary Goal</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRIMARY_GOALS.map((goal) => (
            <button
              key={goal.value}
              type="button"
              onClick={() => update("primaryGoal", goal.value)}
              className={cn(
                "card p-4 text-left transition-colors",
                form.primaryGoal === goal.value
                  ? "ring-2 ring-primary-500 bg-primary-50/50 dark:bg-primary-950/20"
                  : "hover:bg-surface-50 dark:hover:bg-surface-800/50"
              )}
            >
              <p className="text-sm font-semibold text-[var(--foreground)]">{goal.label}</p>
              <p className="text-xs text-muted mt-0.5">{goal.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── 5. Competition Dates ───────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Competition Dates
        </h2>

        {form.competitionDates.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-muted">No competitions scheduled</p>
          </div>
        ) : (
          <div className="space-y-2">
            {form.competitionDates.map((cd, idx) => (
              <div
                key={idx}
                className="card p-3 flex flex-col sm:flex-row items-start sm:items-center gap-2"
              >
                <input
                  type="date"
                  value={cd.date}
                  onChange={(e) => updateCompetitionDate(idx, "date", e.target.value)}
                  className="input w-full sm:w-auto flex-shrink-0"
                  aria-label="Competition date"
                />
                <input
                  type="text"
                  value={cd.name}
                  onChange={(e) => updateCompetitionDate(idx, "name", e.target.value)}
                  placeholder="Meet name"
                  className="input w-full sm:flex-1"
                  aria-label="Competition name"
                />
                <select
                  value={cd.priority}
                  onChange={(e) => updateCompetitionDate(idx, "priority", e.target.value)}
                  className="input w-full sm:w-auto flex-shrink-0"
                  aria-label="Competition priority"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeCompetitionDate(idx)}
                  className="p-1.5 rounded-lg text-surface-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors flex-shrink-0"
                  aria-label="Remove competition"
                >
                  <X size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addCompetitionDate}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
        >
          <CalendarPlus size={14} strokeWidth={1.75} aria-hidden="true" />
          Add Competition
        </button>
      </section>

      {/* ── Error Display ──────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-danger-50 dark:bg-danger-500/10 border border-danger-200 dark:border-danger-500/30 rounded-xl">
          <AlertTriangle
            size={16}
            strokeWidth={1.75}
            className="text-danger-500 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-sm text-danger-700 dark:text-danger-300">{error}</p>
        </div>
      )}

      {/* ── 6. Regenerate Button ───────────────────────────────────────── */}
      <section className="space-y-2">
        <p className="text-xs text-muted text-center">
          Completed sessions are preserved in your history.
        </p>

        {/* Mobile: Slide to confirm */}
        <div className="sm:hidden">
          <SlideToConfirm
            label={regenerating ? "Regenerating…" : "Slide to Regenerate Program"}
            onConfirm={regenerate}
            disabled={regenerating}
            variant="confirm"
          />
        </div>

        {/* Desktop: Button with window.confirm */}
        <div className="hidden sm:flex">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleDesktopRegenerate}
            loading={regenerating}
            leftIcon={
              regenerating ? undefined : (
                <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
              )
            }
          >
            {regenerating ? "Regenerating…" : "Regenerate Program"}
          </Button>
        </div>
      </section>
      <ConfirmDialogPortal />
    </div>
  );
}
