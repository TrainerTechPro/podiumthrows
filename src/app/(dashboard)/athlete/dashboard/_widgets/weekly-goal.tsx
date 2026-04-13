"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Target, Plus, Check } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PRCelebration } from "@/components/ui/PRCelebration";
import { AnimatedNumber } from "@/components";
import { csrfHeaders } from "@/lib/csrf-client";
import { Input } from "@/components/ui/Input";
import type { WeeklyGoalData } from "@/lib/data/dashboard-progress";

/* ─── Types ──────────────────────────────────────────────────────────────── */

const PRESETS = [30, 50, 80] as const;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function daysUntil(iso: string): number {
  const deadline = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)));
}

/* ─── Main widget ────────────────────────────────────────────────────────── */

export function WeeklyGoalWidget({ data }: { data: WeeklyGoalData }) {
  const router = useRouter();
  const [showSetDialog, setShowSetDialog] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Fire the celebration once per (goalId, completion) — tracked in
  // localStorage so refreshing the page doesn't re-trigger the confetti
  // on an already-acknowledged win.
  useEffect(() => {
    if (!data.goal || !data.isHit) return;
    const key = `weekly-goal-${data.goal.id}-celebrated`;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(key)) return;
    setShowCelebration(true);
    window.localStorage.setItem(key, new Date().toISOString());
  }, [data.goal, data.isHit]);

  const daysRemaining = data.goal?.deadline ? daysUntil(data.goal.deadline) : null;

  return (
    <>
      <PRCelebration
        show={showCelebration}
        onDismiss={() => setShowCelebration(false)}
        icon="🎯"
        title="Weekly goal crushed!"
        subtitle={data.goal ? `${data.currentValue}/${data.goal.targetValue} throws` : undefined}
      />

      <div className="card px-4 py-4 shadow-sm md:hover:shadow-md md:transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            Weekly Goal
          </h3>
          {data.goal && !showSetDialog && (
            <button
              type="button"
              onClick={() => setShowSetDialog(true)}
              className="text-xs text-primary-500 hover:underline"
            >
              Change
            </button>
          )}
        </div>

        {showSetDialog ? (
          <SetGoalDialog
            initialValue={data.goal?.targetValue ?? 30}
            onClose={() => setShowSetDialog(false)}
            onSaved={() => {
              setShowSetDialog(false);
              router.refresh();
            }}
          />
        ) : !data.goal ? (
          <EmptyState onSetGoal={() => setShowSetDialog(true)} />
        ) : (
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-3xl font-bold font-heading tabular-nums text-[var(--foreground)]">
                <AnimatedNumber value={data.currentValue} decimals={0} />
                <span className="text-base font-normal text-muted"> / {data.goal.targetValue}</span>
              </p>
              <div className="text-right">
                <p className="text-xs font-semibold tabular-nums text-primary-500">
                  {data.progressPct}%
                </p>
                {daysRemaining != null && (
                  <p className="text-[10px] text-muted">
                    {daysRemaining === 0 ? "Last day" : `${daysRemaining}d left`}
                  </p>
                )}
              </div>
            </div>
            <ProgressBar
              value={data.progressPct}
              variant={data.isHit ? "success" : "primary"}
              size="md"
            />
            {data.isHit && (
              <p className="mt-2 text-xs font-semibold text-emerald-500 flex items-center gap-1">
                <Check className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                Goal reached — keep the momentum going.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────────── */

function EmptyState({ onSetGoal }: { onSetGoal: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-4 gap-3">
      <p className="text-sm text-muted max-w-[220px]">
        Set a throws target for the week and track your progress.
      </p>
      <button
        type="button"
        onClick={onSetGoal}
        className="btn btn-primary text-xs inline-flex items-center gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        Set weekly goal
      </button>
    </div>
  );
}

/* ─── Set goal dialog (inline, not a modal) ─────────────────────────────── */

function SetGoalDialog({
  initialValue,
  onClose,
  onSaved,
}: {
  initialValue: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<number>(initialValue);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function endOfWeekIso(): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 = Sun
    const offset = day === 0 ? 0 : 7 - day;
    d.setDate(d.getDate() + offset);
    d.setHours(23, 59, 59, 0);
    return d.toISOString();
  }

  function handleSave() {
    setError(null);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Target must be a positive number.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/athlete/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            title: "This Week",
            unit: "throws",
            targetValue: value,
            deadline: endOfWeekIso(),
            startingValue: 0,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Could not save goal.");
          return;
        }
        onSaved();
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((preset) => {
          const active = value === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => setValue(preset)}
              className={`rounded-lg px-3 py-2 text-sm font-bold tabular-nums transition-all ${
                active
                  ? "bg-primary-500/10 border border-primary-500 text-[var(--foreground)]"
                  : "border border-[var(--card-border)] bg-surface-50 dark:bg-surface-900/50 text-muted hover:text-[var(--foreground)]"
              }`}
            >
              {preset}
            </button>
          );
        })}
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1">Custom target</label>
        <Input
          type="number"
          min={1}
          value={value}
          onChange={(e) => setValue(parseInt(e.target.value, 10) || 0)}
          className="w-full tabular-nums"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="btn btn-secondary flex-1 text-xs"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="btn btn-primary flex-1 text-xs"
        >
          {isPending ? "Saving…" : "Save goal"}
        </button>
      </div>
    </div>
  );
}
