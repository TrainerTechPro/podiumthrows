"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TrendingUp } from "lucide-react";

/* ─── Option Data ─────────────────────────────────────────────────────────── */

const CATEGORY_OPTIONS = [
  { value: "CE", label: "CE — Competitive Exercise" },
  { value: "SDE", label: "SDE — Special Developmental" },
  { value: "SPE", label: "SPE — Special Preparatory" },
  { value: "GPE", label: "GPE — General Preparatory" },
];

const EVENT_OPTIONS = [
  { value: "", label: "None (General)" },
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
];

const EQUIPMENT_OPTIONS = [
  { value: "", label: "None" },
  { value: "implement", label: "Implement" },
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "medicine ball", label: "Medicine Ball" },
  { value: "band", label: "Resistance Band" },
  { value: "bodyweight", label: "Bodyweight" },
];

const TYPE_LABELS: Record<string, string> = {
  SD: "Special Developmental",
  SP: "Special Preparatory",
};

/* ─── Types ───────────────────────────────────────────────────────────────── */

type ExerciseFormData = {
  id?: string;
  name: string;
  description: string;
  category: string;
  event: string;
  implementWeight: string;
  equipment: string;
  defaultSets: string;
  defaultReps: string;
};

const EMPTY_FORM: ExerciseFormData = {
  name: "",
  description: "",
  category: "GPE",
  event: "",
  implementWeight: "",
  equipment: "",
  defaultSets: "",
  defaultReps: "",
};

/* ─── Correlation Helpers ─────────────────────────────────────────────────── */

function correlationVariant(absR: number): "success" | "warning" | "info" {
  if (absR >= 0.75) return "success";
  if (absR >= 0.60) return "warning";
  return "info";
}

function correlationTierClasses(absR: number): { dot: string; text: string } {
  if (absR >= 0.75) return { dot: "bg-emerald-500", text: "text-emerald-500" };
  if (absR >= 0.60) return { dot: "bg-amber-500", text: "text-amber-500" };
  return { dot: "bg-blue-500", text: "text-blue-500" };
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function ExerciseModal({
  open,
  onClose,
  exercise,
  correlationMap,
  filterContext,
}: {
  open: boolean;
  onClose: () => void;
  exercise?: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    event: string | null;
    implementWeight: number | null;
    equipment: string | null;
    defaultSets: number | null;
    defaultReps: string | null;
  } | null;
  correlationMap?: Map<string, { correlation: number; absCorrelation: number; type: string }>;
  filterContext?: { event: string; gender: string; band: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!exercise?.id;

  const [form, setForm] = useState<ExerciseFormData>(() =>
    exercise
      ? {
          id: exercise.id,
          name: exercise.name,
          description: exercise.description ?? "",
          category: exercise.category,
          event: exercise.event ?? "",
          implementWeight: exercise.implementWeight?.toString() ?? "",
          equipment: exercise.equipment ?? "",
          defaultSets: exercise.defaultSets?.toString() ?? "",
          defaultReps: exercise.defaultReps ?? "",
        }
      : { ...EMPTY_FORM }
  );

  function updateField(key: keyof ExerciseFormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    setError(null);
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    startTransition(async () => {
      try {
        const body: Record<string, unknown> = {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category: form.category,
          event: form.event || null,
          implementWeight: form.implementWeight ? parseFloat(form.implementWeight) : null,
          equipment: form.equipment || null,
          defaultSets: form.defaultSets ? parseInt(form.defaultSets, 10) : null,
          defaultReps: form.defaultReps.trim() || null,
        };

        const url = isEditing
          ? `/api/coach/exercises/${exercise!.id}`
          : "/api/coach/exercises";
        const method = isEditing ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Something went wrong.");
          return;
        }

        router.refresh();
        onClose();
      } catch {
        setError("Failed to save exercise. Please try again.");
      }
    });
  }

  const showImplementWeight = form.category === "CE" || form.category === "SDE";

  // Look up correlation for the current exercise name
  const corrMatch = exercise && correlationMap
    ? correlationMap.get(exercise.name.toLowerCase())
    : undefined;

  return (
    <Modal
      open={open}
      onClose={isPending ? () => {} : onClose}
      preventClose={isPending}
      size="md"
      title={isEditing ? "Edit Exercise" : "Add Exercise"}
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            loading={isPending}
          >
            {isEditing ? "Save Changes" : "Create Exercise"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Name */}
        <Input
          label="Exercise Name"
          placeholder="e.g. Power Position Shot Put"
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
          required
        />

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
            Description <span className="text-muted font-normal">(optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Brief description or coaching cues..."
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            className="input w-full resize-none"
          />
        </div>

        {/* Transfer Coefficient Section */}
        {isEditing && corrMatch && filterContext && (
          <div className="rounded-lg border border-[var(--card-border)] bg-surface-50 dark:bg-surface-800/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Transfer Coefficient
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div>
                <span className="text-muted text-xs">Event</span>
                <p className="text-[var(--foreground)]">{filterContext.event} ({filterContext.gender})</p>
              </div>
              <div>
                <span className="text-muted text-xs">Band</span>
                <p className="text-[var(--foreground)]">{filterContext.band}</p>
              </div>
              <div>
                <span className="text-muted text-xs">Type</span>
                <p className="text-[var(--foreground)]">{TYPE_LABELS[corrMatch.type] ?? corrMatch.type}</p>
              </div>
              <div>
                <span className="text-muted text-xs">Correlation</span>
                <p className={`font-semibold tabular-nums ${correlationTierClasses(corrMatch.absCorrelation).text}`}>
                  {corrMatch.absCorrelation.toFixed(3)}
                </p>
              </div>
            </div>

            <ProgressBar
              value={corrMatch.absCorrelation * 100}
              variant={correlationVariant(corrMatch.absCorrelation)}
              size="sm"
              showLabel
              label={`${(corrMatch.absCorrelation * 100).toFixed(1)}%`}
              animate={false}
            />
          </div>
        )}

        {/* Category + Event row */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Category"
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={(v) => updateField("category", v)}
            required
          />
          <Select
            label="Event"
            options={EVENT_OPTIONS}
            value={form.event}
            onChange={(v) => updateField("event", v)}
          />
        </div>

        {/* Equipment + Implement Weight */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Equipment"
            options={EQUIPMENT_OPTIONS}
            value={form.equipment}
            onChange={(v) => updateField("equipment", v)}
          />
          {showImplementWeight && (
            <Input
              label="Implement Weight (kg)"
              type="number"
              placeholder="7.26"
              value={form.implementWeight}
              onChange={(e) => updateField("implementWeight", e.target.value)}
              min={0}
              step={0.01}
            />
          )}
        </div>

        {/* Defaults row */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Default Sets"
            type="number"
            placeholder="3"
            value={form.defaultSets}
            onChange={(e) => updateField("defaultSets", e.target.value)}
            min={1}
          />
          <Input
            label="Default Reps"
            placeholder='e.g. "5" or "8-12"'
            value={form.defaultReps}
            onChange={(e) => updateField("defaultReps", e.target.value)}
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </Modal>
  );
}
