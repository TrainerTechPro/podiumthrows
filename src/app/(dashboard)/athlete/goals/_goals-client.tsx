"use client";

import { useState, useCallback, useTransition } from "react";
import { Badge, Button, EmptyState, Modal, ProgressBar, useConfirm } from "@/components";
import { Input } from "@/components/ui/Input";
import type { GoalItem } from "@/lib/data/coach";
import { formatEventType } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";

/* ─── Constants ──────────────────────────────────────────────────────────── */

const EVENTS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"] as const;

const STATUS_BADGE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "warning",
  COMPLETED: "success",
  ABANDONED: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ABANDONED: "Abandoned",
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatProjectedDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

function progressVariant(pct: number): "success" | "primary" | "warning" | "danger" {
  if (pct >= 100) return "success";
  if (pct >= 60) return "primary";
  if (pct >= 30) return "warning";
  return "danger";
}

/* ─── Add / Update Goal Form ─────────────────────────────────────────────── */

interface GoalFormData {
  title: string;
  targetValue: string;
  unit: string;
  startingValue: string;
  deadline: string;
  event: string;
  description: string;
}

const EMPTY_FORM: GoalFormData = {
  title: "",
  targetValue: "",
  unit: "",
  startingValue: "",
  deadline: "",
  event: "",
  description: "",
};

interface GoalFormProps {
  initial?: GoalFormData;
  onSubmit: (data: GoalFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  error?: string | null;
}

function GoalForm({ initial = EMPTY_FORM, onSubmit, onCancel, submitLabel = "Create Goal", isSubmitting, error }: GoalFormProps) {
  const [form, setForm] = useState<GoalFormData>(initial);

  const set = (field: keyof GoalFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Goal Title"
        placeholder="e.g. Hit 20m in Shot Put"
        value={form.title}
        onChange={set("title")}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Target Value"
          type="number"
          min="0"
          step="any"
          placeholder="20.00"
          value={form.targetValue}
          onChange={set("targetValue")}
          required
        />
        <Input
          label="Unit"
          placeholder="meters, kg, reps..."
          value={form.unit}
          onChange={set("unit")}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Starting Value"
          type="number"
          min="0"
          step="any"
          placeholder="17.50"
          value={form.startingValue}
          onChange={set("startingValue")}
          helper="Used to calculate progress %"
        />
        <Input
          label="Target Date"
          type="date"
          value={form.deadline}
          onChange={set("deadline")}
        />
      </div>

      {/* Event select */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-[var(--foreground)]">
          Event <span className="text-muted font-normal">(optional)</span>
        </label>
        <select
          value={form.event}
          onChange={set("event")}
          className="input w-full"
        >
          <option value="">No specific event</option>
          {EVENTS.map((ev) => (
            <option key={ev} value={ev}>{formatEventType(ev)}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-[var(--foreground)]">
          Notes <span className="text-muted font-normal">(optional)</span>
        </label>
        <textarea
          value={form.description}
          onChange={set("description")}
          rows={2}
          placeholder="Any context about this goal..."
          className="input w-full resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/* ─── Update Progress Inline Form ────────────────────────────────────────── */

interface UpdateProgressProps {
  goal: GoalItem;
  onUpdate: (id: string, currentValue: number) => Promise<void>;
}

function UpdateProgressInline({ goal, onUpdate }: UpdateProgressProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(goal.currentValue));
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    startTransition(async () => {
      await onUpdate(goal.id, num);
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
      >
        Update Progress
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="input input-sm w-24 tabular-nums text-sm"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <span className="text-xs text-muted">{goal.unit}</span>
      <button
        onClick={handleSave}
        disabled={isPending}
        className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
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

/* ─── Adjust Deadline Inline ────────────────────────────────────────────── */

interface AdjustDeadlineProps {
  goal: GoalItem;
  onUpdateDeadline: (id: string, deadline: string | null) => Promise<void>;
}

function AdjustDeadlineInline({ goal, onUpdateDeadline }: AdjustDeadlineProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(goal.deadline ? goal.deadline.split("T")[0] : "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await onUpdateDeadline(goal.id, value || null);
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-muted hover:text-primary-500 transition-colors"
        title="Adjust deadline"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-px mr-0.5">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Edit
      </button>
    );
  }

  // Re-project completion based on new deadline
  const newDeadline = value ? new Date(value + "T00:00:00") : null;
  const daysUntilDeadline = newDeadline ? Math.ceil((newDeadline.getTime() - Date.now()) / 86_400_000) : null;
  const remaining = goal.targetValue - goal.currentValue;
  const rateNeeded = daysUntilDeadline && daysUntilDeadline > 0 && remaining > 0
    ? (remaining / daysUntilDeadline)
    : null;

  return (
    <div className="flex flex-col gap-1.5 mt-1">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input input-sm text-sm w-36"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <button
          onClick={handleSave}
          disabled={isPending}
          className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => { setEditing(false); setValue(goal.deadline ? goal.deadline.split("T")[0] : ""); }}
          className="text-xs text-muted hover:text-[var(--foreground)]"
        >
          Cancel
        </button>
      </div>
      {rateNeeded !== null && daysUntilDeadline !== null && (
        <p className="text-[10px] text-muted">
          {daysUntilDeadline} days left — need ~{rateNeeded.toFixed(2)} {goal.unit}/day to hit target
        </p>
      )}
      {daysUntilDeadline !== null && daysUntilDeadline <= 0 && value && (
        <p className="text-[10px] text-danger-500 font-medium">
          This date is in the past
        </p>
      )}
    </div>
  );
}

/* ─── Goal Card ──────────────────────────────────────────────────────────── */

interface GoalCardProps {
  goal: GoalItem;
  onUpdateProgress: (id: string, value: number) => Promise<void>;
  onUpdateDeadline: (id: string, deadline: string | null) => Promise<void>;
  onAbandon: (id: string) => void;
}

function GoalCard({ goal, onUpdateProgress, onUpdateDeadline, onAbandon }: GoalCardProps) {
  const overdue = isOverdue(goal.deadline);
  const isActive = goal.status === "ACTIVE";
  const isCompleted = goal.status === "COMPLETED";

  return (
    <div className={`card p-4 space-y-3 ${isCompleted ? "opacity-80" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
            {isCompleted && <span className="mr-1">🏅</span>}
            {goal.title}
          </h3>
          {goal.description && (
            <p className="text-xs text-muted mt-0.5 line-clamp-1">{goal.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {goal.event && (
            <Badge variant="primary">{formatEventType(goal.event)}</Badge>
          )}
          <Badge variant={STATUS_BADGE[goal.status] ?? "neutral"}>
            {STATUS_LABEL[goal.status] ?? goal.status}
          </Badge>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="tabular-nums font-medium text-[var(--foreground)]">
            {goal.currentValue} / {goal.targetValue} {goal.unit}
          </span>
          <span className="font-semibold tabular-nums" style={{ color: goal.progressPct >= 100 ? "#10b981" : "#f59e0b" }}>
            {goal.progressPct}%
          </span>
        </div>
        <ProgressBar
          value={goal.progressPct}
          variant={progressVariant(goal.progressPct)}
          size="sm"
          animate
        />
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
        <div className="flex items-center gap-3">
          {goal.deadline && (
            <span className={overdue && isActive ? "text-danger-500 font-medium" : ""}>
              {overdue && isActive ? "⚠️ " : ""}
              Due {formatProjectedDate(goal.deadline)}
            </span>
          )}
          {goal.projectedCompletionDate && isActive && (
            <span>
              On track for {formatProjectedDate(goal.projectedCompletionDate)}
            </span>
          )}
          {isActive && (
            <AdjustDeadlineInline goal={goal} onUpdateDeadline={onUpdateDeadline} />
          )}
        </div>

        {isActive && (
          <div className="flex items-center gap-3">
            <UpdateProgressInline goal={goal} onUpdate={onUpdateProgress} />
            <button
              onClick={() => void onAbandon(goal.id)}
              className="text-xs text-muted hover:text-danger-500 transition-colors"
            >
              Abandon
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Client Component ──────────────────────────────────────────────── */

interface GoalsClientProps {
  initialGoals: GoalItem[];
}

export function GoalsClient({ initialGoals }: GoalsClientProps) {
  const [goals, setGoals] = useState<GoalItem[]>(initialGoals);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, startAddTransition] = useTransition();

  const activeGoals = goals.filter((g) => g.status === "ACTIVE");
  const completedGoals = goals.filter((g) => g.status === "COMPLETED");
  const abandonedGoals = goals.filter((g) => g.status === "ABANDONED");

  /* ── Create goal ── */
  const handleCreate = useCallback(async (form: GoalFormData) => {
    setAddError(null);
    startAddTransition(async () => {
      try {
        const res = await fetch("/api/athlete/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            title: form.title,
            targetValue: parseFloat(form.targetValue),
            unit: form.unit,
            startingValue: form.startingValue ? parseFloat(form.startingValue) : null,
            deadline: form.deadline || null,
            event: form.event || null,
            description: form.description || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setAddError(data.error ?? "Failed to create goal.");
          return;
        }
        // Fetch fresh list
        const listRes = await fetch("/api/athlete/goals");
        const listData = await listRes.json();
        if (listRes.ok) setGoals(listData.goals ?? []);
        setShowAddModal(false);
      } catch {
        setAddError("Something went wrong.");
      }
    });
  }, []);

  /* ── Update progress ── */
  const handleUpdateProgress = useCallback(async (id: string, currentValue: number) => {
    try {
      const res = await fetch(`/api/athlete/goals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ currentValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setGoals((prev) =>
          prev.map((g) =>
            g.id === id
              ? {
                  ...g,
                  currentValue: data.goal.currentValue,
                  status: data.goal.status,
                  progressPct: Math.min(
                    100,
                    Math.max(
                      0,
                      Math.round(
                        ((currentValue - (g.startingValue ?? 0)) /
                          (g.targetValue - (g.startingValue ?? 0))) *
                          100
                      )
                    )
                  ),
                }
              : g
          )
        );
      }
    } catch {
      // Silent fail — will refresh on next nav
    }
  }, []);

  /* ── Update deadline ── */
  const handleUpdateDeadline = useCallback(async (id: string, deadline: string | null) => {
    try {
      const res = await fetch(`/api/athlete/goals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ deadline: deadline ?? "" }),
      });
      const data = await res.json();
      if (res.ok) {
        setGoals((prev) =>
          prev.map((g) =>
            g.id === id
              ? { ...g, deadline: data.goal.deadline }
              : g
          )
        );
      }
    } catch {
      // Silent fail
    }
  }, []);

  /* ── Abandon goal ── */
  const handleAbandon = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/athlete/goals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ status: "ABANDONED" }),
      });
      if (res.ok) {
        setGoals((prev) =>
          prev.map((g) => (g.id === id ? { ...g, status: "ABANDONED" } : g))
        );
      }
    } catch {
      // Silent fail
    }
  }, []);

  /* ── Abandon request with confirmation ── */
  const { confirm: confirmAbandon, Dialog: AbandonConfirmDialog } = useConfirm();

  const handleAbandonRequest = (id: string) => {
    confirmAbandon({
      title: "Abandon this goal?",
      description: "This will mark the goal as abandoned. You can view it in history but it won't count toward your active goals.",
      confirmLabel: "Abandon",
      variant: "danger",
      onConfirm: () => handleAbandon(id),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">My Goals</h1>
          <p className="text-sm text-muted mt-0.5">
            {activeGoals.length} active goal{activeGoals.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Goal
        </Button>
      </div>

      {/* Empty state */}
      {goals.length === 0 && (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          }
          title="No goals yet"
          description="Set SMART goals to track your progress toward competition distances and personal bests."
          action={
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              Create your first goal
            </Button>
          }
        />
      )}

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wider">
            Active
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {activeGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onUpdateProgress={handleUpdateProgress}
                onUpdateDeadline={handleUpdateDeadline}
                onAbandon={handleAbandonRequest}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-success-600 dark:text-success-400 uppercase tracking-wider">
            Completed
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {completedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onUpdateProgress={handleUpdateProgress}
                onUpdateDeadline={handleUpdateDeadline}
                onAbandon={handleAbandonRequest}
              />
            ))}
          </div>
        </section>
      )}

      {/* Abandoned Goals */}
      {abandonedGoals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Abandoned
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {abandonedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onUpdateProgress={handleUpdateProgress}
                onUpdateDeadline={handleUpdateDeadline}
                onAbandon={handleAbandonRequest}
              />
            ))}
          </div>
        </section>
      )}

      {/* Abandon Confirmation */}
      <AbandonConfirmDialog />

      {/* Add Goal Modal */}
      <Modal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setAddError(null);
        }}
        title="Create New Goal"
        size="md"
      >
        <GoalForm
          onSubmit={handleCreate}
          onCancel={() => {
            setShowAddModal(false);
            setAddError(null);
          }}
          submitLabel="Create Goal"
          isSubmitting={isAdding}
          error={addError}
        />
      </Modal>
    </div>
  );
}
