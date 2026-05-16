"use client";

import { useCallback, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Sparkles, Target, Trophy } from "lucide-react";
import { Badge, Button, EmptyState, ProgressBar, StaggeredList, useConfirm } from "@/components";
import { useToast } from "@/components/ui/Toast";
import { PRCelebration } from "@/components/ui/PRCelebration";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";
import { formatEventType } from "@/lib/utils";
import { fireGoalCelebrations } from "@/lib/goals/celebrate-client";
import type { MilestoneCelebration } from "@/lib/goals/milestones";
import type { DecoratedGoal, GoalsPageData } from "@/lib/data/goals";
import type { SuggestedGoal } from "@/lib/goals/suggestions";
import { GoalWizardSheet, type GoalKind } from "./_goal-wizard-sheet";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2).replace(/\.?0+$/, "");
}

function progressVariant(pct: number): "success" | "primary" | "warning" | "danger" {
  if (pct >= 100) return "success";
  if (pct >= 60) return "primary";
  if (pct >= 30) return "warning";
  return "danger";
}

function daysLabel(days: number | null, isActive: boolean): { text: string; tone: string } {
  if (days === null) return { text: "No deadline", tone: "text-muted" };
  if (days < 0)
    return {
      text: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`,
      tone: isActive ? "text-danger-500 font-medium" : "text-muted",
    };
  if (days === 0) return { text: "Due today", tone: "text-primary-500 font-medium" };
  return {
    text: `${days} day${days === 1 ? "" : "s"} left`,
    tone: days <= 7 ? "text-primary-500 font-medium" : "text-muted",
  };
}

/* ─── Inline progress editor ─────────────────────────────────────────────── */

interface InlineProgressProps {
  goal: DecoratedGoal;
  onSave: (id: string, value: number) => Promise<void>;
}

function InlineProgressEditor({ goal, onSave }: InlineProgressProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(goal.currentValue));
  const [pending, startTransition] = useTransition();

  function commit() {
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return;
    startTransition(async () => {
      await onSave(goal.id, n);
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <button
        onClick={() => {
          setValue(String(goal.currentValue));
          setEditing(true);
        }}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
      >
        <Pencil size={11} strokeWidth={1.75} aria-hidden="true" />
        Update progress
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="input input-sm w-24 text-sm tabular-nums"
      />
      <span className="text-xs text-muted">{goal.unit}</span>
      <button
        onClick={commit}
        disabled={pending}
        className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        onClick={() => setEditing(false)}
        className="text-xs text-muted hover:text-[var(--foreground)]"
      >
        Cancel
      </button>
    </div>
  );
}

/* ─── Active goal card ───────────────────────────────────────────────────── */

interface ActiveGoalCardProps {
  goal: DecoratedGoal;
  onUpdateProgress: (id: string, value: number) => Promise<void>;
  onAbandon: (id: string) => void;
}

function ActiveGoalCard({ goal, onUpdateProgress, onAbandon }: ActiveGoalCardProps) {
  const days = daysLabel(goal.daysUntilDeadline, true);
  const remaining = Math.max(0, goal.targetValue - goal.currentValue);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">{goal.title}</h3>
          {goal.description && (
            <p className="text-xs text-muted mt-0.5 line-clamp-2">{goal.description}</p>
          )}
        </div>
        {goal.event && (
          <Badge variant="primary" className="shrink-0">
            {formatEventType(goal.event)}
          </Badge>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono tabular-nums text-[var(--foreground)]">
            <span className="font-semibold">{formatNumber(goal.currentValue)}</span>
            <span className="text-muted"> / {formatNumber(goal.targetValue)}</span>{" "}
            <span className="text-muted">{goal.unit}</span>
          </span>
          <span
            className="font-mono font-semibold tabular-nums"
            style={{ color: goal.progressPct >= 100 ? "#10b981" : "#f59e0b" }}
          >
            {goal.progressPct}%
          </span>
        </div>
        <ProgressBar
          value={goal.progressPct}
          variant={progressVariant(goal.progressPct)}
          size="sm"
          animate
        />
        {remaining > 0 && (
          <p className="text-micro text-muted">
            <span className="font-mono tabular-nums">{formatNumber(remaining)}</span> {goal.unit} to
            go
          </p>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1 text-micro">
        <div className="flex items-center gap-2">
          {goal.deadline ? (
            <span className={days.tone}>
              {days.text} · {formatDate(goal.deadline)}
            </span>
          ) : (
            <span className="text-muted">No deadline</span>
          )}
          {goal.projectedCompletionDate && (
            <span className="text-muted">
              · on track for {formatDate(goal.projectedCompletionDate)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <InlineProgressEditor goal={goal} onSave={onUpdateProgress} />
          <button
            onClick={() => onAbandon(goal.id)}
            className="inline-flex items-center px-3 min-h-[44px] text-xs text-muted hover:text-danger-500 transition-colors"
          >
            Abandon
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Achieved goal card (compact) ────────────────────────────────────────── */

function AchievedGoalCard({ goal }: { goal: DecoratedGoal }) {
  return (
    <div className="card p-3 flex items-center gap-3 opacity-90">
      <div
        className="w-9 h-9 rounded-xl bg-success-500/15 text-success-600 dark:text-success-400 flex items-center justify-center shrink-0"
        aria-hidden="true"
      >
        <Trophy size={16} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[var(--foreground)] truncate">{goal.title}</div>
        <div className="text-micro text-muted font-mono tabular-nums">
          {formatNumber(goal.currentValue)} {goal.unit}
          {goal.event && <span className="ml-1.5 text-muted">· {formatEventType(goal.event)}</span>}
        </div>
      </div>
    </div>
  );
}

/* ─── Suggestion card ─────────────────────────────────────────────────────── */

interface SuggestedGoalCardProps {
  suggestion: SuggestedGoal;
  onAccept: (s: SuggestedGoal) => void;
}

function SuggestedGoalCard({ suggestion, onAccept }: SuggestedGoalCardProps) {
  return (
    <div className="card p-4 flex items-start gap-3 border-primary-500/20 bg-primary-500/5">
      <div
        className="w-9 h-9 rounded-xl bg-primary-500/15 text-primary-500 flex items-center justify-center shrink-0"
        aria-hidden="true"
      >
        <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{suggestion.title}</h3>
        <p className="text-xs text-muted mt-0.5">{suggestion.description}</p>
      </div>
      <Button size="sm" onClick={() => onAccept(suggestion)}>
        Accept
      </Button>
    </div>
  );
}

/* ─── Main client ─────────────────────────────────────────────────────────── */

interface GoalsClientProps {
  initialData: GoalsPageData;
}

export function GoalsClient({ initialData }: GoalsClientProps) {
  const toast = useToast();
  const [data, setData] = useState<GoalsPageData>(initialData);
  const [showAchieved, setShowAchieved] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPreset, setWizardPreset] = useState<
    React.ComponentProps<typeof GoalWizardSheet>["preset"] | undefined
  >(undefined);
  const [completion, setCompletion] = useState<MilestoneCelebration | null>(null);

  /* ─── Refresh ─── */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/athlete/goals");
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data) {
        setData({
          active: json.data.active,
          achieved: json.data.achieved,
          abandoned: json.data.abandoned,
          suggested: json.data.suggested,
        });
      }
    } catch (err) {
      logger.warn("goals refresh failed", {
        context: "athlete/goals",
        metadata: { err: String(err) },
      });
    }
  }, []);

  /* ─── Update progress ─── */
  const handleUpdateProgress = useCallback(
    async (id: string, currentValue: number) => {
      try {
        const res = await fetch(`/api/athlete/goals/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ currentValue }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || `Failed to update progress (${res.status}).`);
        }
        if (json.celebration) {
          fireGoalCelebrations([json.celebration as MilestoneCelebration], toast, (c) =>
            setCompletion(c)
          );
        } else {
          toast.success("Progress updated");
        }
        await refresh();
      } catch (err) {
        logger.error("goal progress update failed", { context: "athlete/goals", error: err });
        toast.error(err instanceof Error ? err.message : "Couldn't save progress.");
      }
    },
    [toast, refresh]
  );

  /* ─── Abandon goal ─── */
  const { confirm, Dialog } = useConfirm();
  const handleAbandon = (id: string) => {
    confirm({
      title: "Abandon this goal?",
      description: "It moves to history and stops counting toward your active goals.",
      confirmLabel: "Abandon",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/athlete/goals/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ status: "ABANDONED" }),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.success) {
            throw new Error(json?.error || `Failed to abandon (${res.status}).`);
          }
          toast.success("Goal abandoned");
          await refresh();
        } catch (err) {
          logger.error("goal abandon failed", { context: "athlete/goals", error: err });
          toast.error(err instanceof Error ? err.message : "Couldn't abandon goal.");
        }
      },
    });
  };

  /* ─── Suggested goal accept ─── */
  const handleAcceptSuggestion = (s: SuggestedGoal) => {
    setWizardPreset({
      kind: s.kind === "STRENGTH" ? "WEIGHT" : (s.kind as GoalKind),
      title: s.title,
      targetValue: s.targetValue,
      unit: s.unit,
      event: s.event,
      deadline: s.deadline,
      startingValue: s.startingValue ?? null,
      description: s.description,
    });
    setWizardOpen(true);
  };

  /* ─── Render ─── */
  const showSuggested = data.active.length < 3 && data.suggested.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">My Goals</h1>
          <p className="text-sm text-muted mt-0.5">
            {data.active.length} active · {data.achieved.length} achieved
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setWizardPreset(undefined);
            setWizardOpen(true);
          }}
        >
          <Plus size={14} strokeWidth={1.75} className="mr-1.5" aria-hidden="true" />
          New goal
        </Button>
      </div>

      {/* Empty state */}
      {data.active.length === 0 && data.achieved.length === 0 && (
        <EmptyState
          icon={<Target size={24} strokeWidth={1.75} aria-hidden="true" />}
          title="No goals yet"
          description="Set one. Then go earn it."
          action={
            <Button
              size="sm"
              onClick={() => {
                setWizardPreset(undefined);
                setWizardOpen(true);
              }}
            >
              Create your first goal
            </Button>
          }
        />
      )}

      {/* Active */}
      {data.active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wider">
            Active
          </h2>
          <StaggeredList className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {data.active.map((goal) => (
              <ActiveGoalCard
                key={goal.id}
                goal={goal}
                onUpdateProgress={handleUpdateProgress}
                onAbandon={handleAbandon}
              />
            ))}
          </StaggeredList>
        </section>
      )}

      {/* Suggested */}
      {showSuggested && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={14} strokeWidth={1.75} aria-hidden="true" />
            Suggested
          </h2>
          <StaggeredList className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {data.suggested.map((s) => (
              <SuggestedGoalCard key={s.key} suggestion={s} onAccept={handleAcceptSuggestion} />
            ))}
          </StaggeredList>
        </section>
      )}

      {/* Achieved (collapsed by default) */}
      {data.achieved.length > 0 && (
        <section className="space-y-3">
          <button
            onClick={() => setShowAchieved((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-success-600 dark:text-success-400 uppercase tracking-wider hover:opacity-80 transition-opacity"
            aria-expanded={showAchieved}
          >
            {showAchieved ? (
              <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
            )}
            Achieved ({data.achieved.length})
          </button>
          {showAchieved && (
            <StaggeredList className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {data.achieved.map((g) => (
                <AchievedGoalCard key={g.id} goal={g} />
              ))}
            </StaggeredList>
          )}
        </section>
      )}

      {/* Wizard sheet */}
      <GoalWizardSheet
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          setWizardPreset(undefined);
        }}
        onCreated={refresh}
        preset={wizardPreset}
      />

      {/* Completion overlay */}
      <PRCelebration
        show={completion !== null}
        onDismiss={() => {
          setCompletion(null);
          void refresh();
        }}
        title="Goal complete!"
        subtitle={completion?.goalTitle}
        icon="🎯"
      />

      <Dialog />
    </div>
  );
}
