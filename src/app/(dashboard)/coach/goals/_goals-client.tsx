"use client";

import { useState, useCallback, useMemo, useTransition } from "react";
import {
  Badge,
  Button,
  EmptyState,
  Modal,
  ProgressBar,
  Avatar,
  useConfirm,
  StaggeredList,
} from "@/components";
import { Input } from "@/components/ui/Input";
import type { TeamGoalItem, AthletePickerItem } from "@/lib/data/coach";
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

/* ─── Goal Form (coach version — includes athlete picker) ────────────────── */

interface GoalFormData {
  athleteId: string;
  title: string;
  targetValue: string;
  unit: string;
  startingValue: string;
  deadline: string;
  event: string;
  description: string;
}

const EMPTY_FORM: GoalFormData = {
  athleteId: "",
  title: "",
  targetValue: "",
  unit: "",
  startingValue: "",
  deadline: "",
  event: "",
  description: "",
};

interface GoalFormProps {
  athletes: AthletePickerItem[];
  initial?: GoalFormData;
  onSubmit: (data: GoalFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  error?: string | null;
}

function GoalForm({
  athletes,
  initial = EMPTY_FORM,
  onSubmit,
  onCancel,
  submitLabel = "Create Goal",
  isSubmitting,
  error,
}: GoalFormProps) {
  const [form, setForm] = useState<GoalFormData>(initial);

  const set =
    (field: keyof GoalFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Athlete picker */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-[var(--foreground)]">Athlete</label>
        <select
          value={form.athleteId}
          onChange={set("athleteId")}
          className="input w-full"
          required
        >
          <option value="">Select an athlete…</option>
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.firstName} {a.lastName}
            </option>
          ))}
        </select>
      </div>

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
        <select value={form.event} onChange={set("event")} className="input w-full">
          <option value="">No specific event</option>
          {EVENTS.map((ev) => (
            <option key={ev} value={ev}>
              {formatEventType(ev)}
            </option>
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

      {error && <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>}

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

/* ─── Update Progress Inline ─────────────────────────────────────────────── */

interface UpdateProgressProps {
  goal: TeamGoalItem;
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
        Update
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

/* ─── Goal Card (coach version — shows athlete name) ─────────────────────── */

interface GoalCardProps {
  goal: TeamGoalItem;
  onUpdateProgress: (id: string, value: number) => Promise<void>;
  onAbandon: (id: string) => void;
}

function GoalCard({ goal, onUpdateProgress, onAbandon }: GoalCardProps) {
  const overdue = isOverdue(goal.deadline);
  const isActive = goal.status === "ACTIVE";
  const isCompleted = goal.status === "COMPLETED";

  return (
    <div className={`card p-4 space-y-3 ${isCompleted ? "opacity-80" : ""}`}>
      {/* Athlete label */}
      <div className="flex items-center gap-2">
        <Avatar
          name={`${goal.athleteFirstName} ${goal.athleteLastName}`}
          size="xs"
        />
        <span className="text-xs font-medium text-muted">
          {goal.athleteFirstName} {goal.athleteLastName}
        </span>
      </div>

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
          {goal.event && <Badge variant="primary">{formatEventType(goal.event)}</Badge>}
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
          <span
            className="font-semibold tabular-nums"
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
            <span>On track for {formatProjectedDate(goal.projectedCompletionDate)}</span>
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

/* ─── Filter Bar ─────────────────────────────────────────────────────────── */

type StatusFilter = "ALL" | "ACTIVE" | "COMPLETED" | "ABANDONED";

interface FilterBarProps {
  athletes: AthletePickerItem[];
  athleteFilter: string;
  onAthleteChange: (id: string) => void;
  eventFilter: string;
  onEventChange: (ev: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  counts: { all: number; active: number; completed: number; abandoned: number };
}

function FilterBar({
  athletes,
  athleteFilter,
  onAthleteChange,
  eventFilter,
  onEventChange,
  statusFilter,
  onStatusChange,
  counts,
}: FilterBarProps) {
  const statusOptions: { value: StatusFilter; label: string; count: number }[] = [
    { value: "ALL", label: "All", count: counts.all },
    { value: "ACTIVE", label: "Active", count: counts.active },
    { value: "COMPLETED", label: "Completed", count: counts.completed },
    { value: "ABANDONED", label: "Abandoned", count: counts.abandoned },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status chips */}
      <div className="flex items-center gap-1.5">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onStatusChange(opt.value)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === opt.value
                ? "bg-primary-500 text-white"
                : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]"
            }`}
          >
            {opt.label}
            <span className="ml-1 opacity-70">{opt.count}</span>
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Athlete filter */}
      <select
        value={athleteFilter}
        onChange={(e) => onAthleteChange(e.target.value)}
        className="input input-sm text-xs min-w-[140px]"
      >
        <option value="">All Athletes</option>
        {athletes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.firstName} {a.lastName}
          </option>
        ))}
      </select>

      {/* Event filter */}
      <select
        value={eventFilter}
        onChange={(e) => onEventChange(e.target.value)}
        className="input input-sm text-xs min-w-[120px]"
      >
        <option value="">All Events</option>
        {EVENTS.map((ev) => (
          <option key={ev} value={ev}>
            {formatEventType(ev)}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ─── Main Client Component ──────────────────────────────────────────────── */

interface CoachGoalsClientProps {
  initialGoals: TeamGoalItem[];
  athletes: AthletePickerItem[];
}

export function CoachGoalsClient({ initialGoals, athletes }: CoachGoalsClientProps) {
  const [goals, setGoals] = useState<TeamGoalItem[]>(initialGoals);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, startAddTransition] = useTransition();

  /* ── Filters ── */
  const [athleteFilter, setAthleteFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const filtered = useMemo(() => {
    let list = goals;
    if (athleteFilter) list = list.filter((g) => g.athleteId === athleteFilter);
    if (eventFilter) list = list.filter((g) => g.event === eventFilter);
    if (statusFilter !== "ALL") list = list.filter((g) => g.status === statusFilter);
    return list;
  }, [goals, athleteFilter, eventFilter, statusFilter]);

  const counts = useMemo(
    () => ({
      all: goals.filter((g) => (athleteFilter ? g.athleteId === athleteFilter : true))
        .filter((g) => (eventFilter ? g.event === eventFilter : true)).length,
      active: goals.filter((g) => g.status === "ACTIVE")
        .filter((g) => (athleteFilter ? g.athleteId === athleteFilter : true))
        .filter((g) => (eventFilter ? g.event === eventFilter : true)).length,
      completed: goals.filter((g) => g.status === "COMPLETED")
        .filter((g) => (athleteFilter ? g.athleteId === athleteFilter : true))
        .filter((g) => (eventFilter ? g.event === eventFilter : true)).length,
      abandoned: goals.filter((g) => g.status === "ABANDONED")
        .filter((g) => (athleteFilter ? g.athleteId === athleteFilter : true))
        .filter((g) => (eventFilter ? g.event === eventFilter : true)).length,
    }),
    [goals, athleteFilter, eventFilter]
  );

  /* ── Create goal ── */
  const handleCreate = useCallback(
    async (form: GoalFormData) => {
      setAddError(null);
      startAddTransition(async () => {
        try {
          const res = await fetch("/api/coach/goals", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({
              athleteId: form.athleteId,
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
          // Refresh full list
          const listRes = await fetch("/api/coach/goals");
          const listData = await listRes.json();
          if (listRes.ok) setGoals(listData.goals ?? []);
          setShowAddModal(false);
        } catch {
          setAddError("Something went wrong.");
        }
      });
    },
    []
  );

  /* ── Update progress ── */
  const handleUpdateProgress = useCallback(async (id: string, currentValue: number) => {
    try {
      const res = await fetch(`/api/coach/goals/${id}`, {
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

  /* ── Abandon goal ── */
  const handleAbandon = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/coach/goals/${id}`, {
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

  /* ── Abandon with confirm ── */
  const { confirm: confirmAbandon, Dialog: AbandonConfirmDialog } = useConfirm();

  const handleAbandonRequest = (id: string) => {
    const goal = goals.find((g) => g.id === id);
    confirmAbandon({
      title: "Abandon this goal?",
      description: goal
        ? `This will mark "${goal.title}" for ${goal.athleteFirstName} ${goal.athleteLastName} as abandoned.`
        : "This will mark the goal as abandoned.",
      confirmLabel: "Abandon",
      variant: "danger",
      onConfirm: () => handleAbandon(id),
    });
  };

  /* ── Group filtered goals by status ── */
  const activeGoals = statusFilter === "ALL" ? filtered.filter((g) => g.status === "ACTIVE") : filtered;
  const completedGoals = statusFilter === "ALL" ? filtered.filter((g) => g.status === "COMPLETED") : [];
  const abandonedGoals = statusFilter === "ALL" ? filtered.filter((g) => g.status === "ABANDONED") : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Team Goals</h1>
          <p className="text-sm text-muted mt-0.5">
            {counts.active} active across {athletes.length} athlete
            {athletes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-1.5"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Goal
        </Button>
      </div>

      {/* Filter Bar */}
      {goals.length > 0 && (
        <FilterBar
          athletes={athletes}
          athleteFilter={athleteFilter}
          onAthleteChange={setAthleteFilter}
          eventFilter={eventFilter}
          onEventChange={setEventFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          counts={counts}
        />
      )}

      {/* Empty state — no goals at all */}
      {goals.length === 0 && (
        <EmptyState
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
          title="No team goals yet"
          description="Set season targets and milestones for your athletes — track PR goals, competition distances, and training benchmarks."
          action={
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              Create first goal
            </Button>
          }
        />
      )}

      {/* No filter results */}
      {goals.length > 0 && filtered.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">No goals match the current filters.</p>
          <button
            onClick={() => {
              setAthleteFilter("");
              setEventFilter("");
              setStatusFilter("ALL");
            }}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline mt-2"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Active Goals (or all filtered when status filter is set) */}
      {activeGoals.length > 0 && (
        <section className="space-y-3">
          {statusFilter === "ALL" && (
            <h2 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wider">
              Active
            </h2>
          )}
          <StaggeredList className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {activeGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onUpdateProgress={handleUpdateProgress}
                onAbandon={handleAbandonRequest}
              />
            ))}
          </StaggeredList>
        </section>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-success-600 dark:text-success-400 uppercase tracking-wider">
            Completed
          </h2>
          <StaggeredList className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {completedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onUpdateProgress={handleUpdateProgress}
                onAbandon={handleAbandonRequest}
              />
            ))}
          </StaggeredList>
        </section>
      )}

      {/* Abandoned Goals */}
      {abandonedGoals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Abandoned
          </h2>
          <StaggeredList className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {abandonedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onUpdateProgress={handleUpdateProgress}
                onAbandon={handleAbandonRequest}
              />
            ))}
          </StaggeredList>
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
        title="Create Goal for Athlete"
        size="md"
      >
        <GoalForm
          athletes={athletes}
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
