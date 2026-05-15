"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Target, Calendar, Dumbbell, Sparkles } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";
import { reportApiError } from "@/lib/form-errors";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type GoalKind = "PR" | "CONSISTENCY" | "WEIGHT" | "CUSTOM";

const EVENTS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"] as const;
const EVENT_LABEL: Record<(typeof EVENTS)[number], string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

interface KindOption {
  value: GoalKind;
  title: string;
  description: string;
  icon: React.ReactNode;
  defaultUnit: string;
  needsEvent: boolean;
}

const KIND_OPTIONS: KindOption[] = [
  {
    value: "PR",
    title: "Personal record",
    description: "Hit a new best in shot, discus, hammer, or javelin.",
    icon: <Target size={18} strokeWidth={1.75} aria-hidden="true" />,
    defaultUnit: "meters",
    needsEvent: true,
  },
  {
    value: "CONSISTENCY",
    title: "Training consistency",
    description: "Show up. Number of logged sessions over a window.",
    icon: <Calendar size={18} strokeWidth={1.75} aria-hidden="true" />,
    defaultUnit: "sessions",
    needsEvent: false,
  },
  {
    value: "WEIGHT",
    title: "Strength PR",
    description: "Hit a number on a lift — squat, clean, bench.",
    icon: <Dumbbell size={18} strokeWidth={1.75} aria-hidden="true" />,
    defaultUnit: "kg",
    needsEvent: false,
  },
  {
    value: "CUSTOM",
    title: "Custom",
    description: "Anything else worth tracking.",
    icon: <Sparkles size={18} strokeWidth={1.75} aria-hidden="true" />,
    defaultUnit: "",
    needsEvent: false,
  },
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function eightWeeksOut(): string {
  const d = new Date();
  d.setDate(d.getDate() + 56);
  return d.toISOString().slice(0, 10);
}

function defaultTitleFor(kind: GoalKind, target: string, unit: string, event: string): string {
  if (kind === "PR" && event && target) {
    return `${target}${unit === "meters" ? "m" : ` ${unit}`} ${EVENT_LABEL[event as keyof typeof EVENT_LABEL] ?? ""}`.trim();
  }
  if (kind === "CONSISTENCY" && target) {
    return `Log ${target} training sessions`;
  }
  if (kind === "WEIGHT" && target) {
    return `Hit ${target}${unit ? unit : "kg"}`;
  }
  return "";
}

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface GoalWizardSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Pre-filled values (used by suggested-goal one-tap accept). */
  preset?: {
    kind: GoalKind;
    title?: string;
    targetValue?: number;
    unit?: string;
    event?: string | null;
    deadline?: string;
    startingValue?: number | null;
    description?: string | null;
  };
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function GoalWizardSheet({ open, onClose, onCreated, preset }: GoalWizardSheetProps) {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [kind, setKind] = useState<GoalKind>("PR");
  const [event, setEvent] = useState<string>("");
  const [unit, setUnit] = useState<string>("meters");
  const [title, setTitle] = useState<string>("");
  const [target, setTarget] = useState<string>("");
  const [deadline, setDeadline] = useState<string>(eightWeeksOut());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from preset whenever the sheet opens with one. Skip to step 3 so
  // the user just confirms the date — that's the spirit of "one-tap accept".
  useEffect(() => {
    if (!open) return;
    if (preset) {
      setKind(preset.kind);
      setEvent(preset.event ?? "");
      setUnit(preset.unit ?? KIND_OPTIONS.find((o) => o.value === preset.kind)?.defaultUnit ?? "");
      setTitle(preset.title ?? "");
      setTarget(preset.targetValue ? String(preset.targetValue) : "");
      setDeadline(preset.deadline ?? eightWeeksOut());
      setStep(3);
    } else {
      setKind("PR");
      setEvent("");
      setUnit("meters");
      setTitle("");
      setTarget("");
      setDeadline(eightWeeksOut());
      setStep(1);
    }
    setError(null);
  }, [open, preset]);

  const kindOption = useMemo(
    () => KIND_OPTIONS.find((o) => o.value === kind) ?? KIND_OPTIONS[0]!,
    [kind]
  );

  function pickKind(next: GoalKind) {
    setKind(next);
    const opt = KIND_OPTIONS.find((o) => o.value === next);
    if (opt) setUnit(opt.defaultUnit);
    if (next !== "PR") setEvent("");
    setStep(2);
  }

  function canAdvanceFromStep2(): boolean {
    if (!target || isNaN(parseFloat(target)) || parseFloat(target) <= 0) return false;
    if (kindOption.needsEvent && !event) return false;
    if (!unit.trim()) return false;
    return true;
  }

  async function handleCreate() {
    setError(null);
    setSubmitting(true);
    const finalTitle = (title.trim() || defaultTitleFor(kind, target, unit, event)).trim();
    if (!finalTitle) {
      setError("Please give your goal a title.");
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch("/api/athlete/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          title: finalTitle,
          targetValue: parseFloat(target),
          unit: unit.trim(),
          startingValue: preset?.startingValue ?? null,
          deadline: deadline || null,
          event: kindOption.needsEvent ? event : null,
          description: preset?.description ?? null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        const info = reportApiError({ res, payload: data }, toast, {
          onRetry: handleCreate,
          silent: true,
        });
        setError(info.message);
        return;
      }
      toast.success("Goal set", "Now go earn it.");
      onCreated();
      onClose();
    } catch (err) {
      logger.error("goal create failed", { context: "athlete/goals/wizard", error: err });
      const info = reportApiError({ err }, toast, { onRetry: handleCreate, silent: true });
      setError(info.message);
    } finally {
      setSubmitting(false);
    }
  }

  /* ─── Step body ─────────────────────────────────────────────────────────── */

  const stepBody =
    step === 1 ? (
      <div className="space-y-2">
        <p className="text-sm text-muted">What kind of goal are we chasing?</p>
        <div className="grid gap-2">
          {KIND_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => pickKind(opt.value)}
              className="text-left card card-interactive p-4 flex items-start gap-3"
            >
              <div
                className="w-9 h-9 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--foreground)]">{opt.title}</div>
                <div className="text-xs text-muted mt-0.5">{opt.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    ) : step === 2 ? (
      <div className="space-y-4">
        <p className="text-sm text-muted">Set the target.</p>

        {kindOption.needsEvent && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">Event</label>
            <div className="grid grid-cols-2 gap-2">
              {EVENTS.map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => setEvent(ev)}
                  className={`px-3 min-h-[44px] rounded-xl text-sm font-medium transition-colors ${
                    event === ev
                      ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30"
                      : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-primary-500/50"
                  }`}
                >
                  {EVENT_LABEL[ev]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input
              label="Target value"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder={kind === "PR" ? "60" : kind === "CONSISTENCY" ? "32" : "0"}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              autoFocus
            />
          </div>
          <Input
            label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="meters"
          />
        </div>

        <div>
          <Input
            label="Title (optional)"
            placeholder={defaultTitleFor(kind, target, unit, event) || "Give it a name"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            helper="Leave blank to use the default."
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
            <ArrowLeft size={14} strokeWidth={1.75} className="mr-1" aria-hidden="true" />
            Back
          </Button>
          <Button size="sm" onClick={() => setStep(3)} disabled={!canAdvanceFromStep2()}>
            Continue
            <ArrowRight size={14} strokeWidth={1.75} className="ml-1" aria-hidden="true" />
          </Button>
        </div>
      </div>
    ) : (
      <div className="space-y-4">
        <p className="text-sm text-muted">When do you want to hit it?</p>

        <Input
          label="Target date"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          helper="Default: 8 weeks from today."
        />

        {/* Confirmation summary */}
        <div className="card p-4 bg-primary-500/5 border-primary-500/20">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Goal</div>
          <div className="text-sm font-semibold text-[var(--foreground)]">
            {title || defaultTitleFor(kind, target, unit, event) || "Your goal"}
          </div>
          {kindOption.needsEvent && event && (
            <div className="text-xs text-muted mt-1">
              {EVENT_LABEL[event as keyof typeof EVENT_LABEL]} · target{" "}
              <span className="font-mono tabular-nums">
                {target} {unit}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-danger-500/10 border border-danger-500/20 text-sm text-danger-600 dark:text-danger-400">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <Button variant="ghost" size="sm" onClick={() => setStep(2)} disabled={submitting}>
            <ArrowLeft size={14} strokeWidth={1.75} className="mr-1" aria-hidden="true" />
            Back
          </Button>
          <Button size="sm" onClick={handleCreate} loading={submitting}>
            <Check size={14} strokeWidth={1.75} className="mr-1" aria-hidden="true" />
            Set goal
          </Button>
        </div>
      </div>
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="bottom"
      size="md"
      title={
        <div className="flex items-center gap-2">
          <span>New goal</span>
          <span className="text-xs font-mono text-muted tabular-nums">{step}/3</span>
        </div>
      }
    >
      {stepBody}
    </Sheet>
  );
}
