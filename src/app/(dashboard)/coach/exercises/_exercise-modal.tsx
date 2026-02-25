"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

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

/* ─── Component ───────────────────────────────────────────────────────────── */

export function ExerciseModal({
  open,
  onClose,
  exercise,
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
