"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type DrillData = {
  id?: string;
  name: string;
  description: string;
  videoUrl: string;
  event: string | null;
  category: string;
  implementKg: string;
  difficulty: string | null;
  cues: string[];
  athleteTypes: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** If set, we're editing an existing drill */
  editDrill?: {
    id: string;
    name: string;
    description: string | null;
    videoUrl: string | null;
    event: string | null;
    category: string;
    implementKg: number | null;
    difficulty: string | null;
    cues: string[];
    athleteTypes: string[];
  } | null;
};

/* ─── Constants ──────────────────────────────────────────────────────────── */

const EVENT_OPTIONS = [
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
];

const CATEGORY_OPTIONS = [
  { value: "CE", label: "Competitive (CE)" },
  { value: "SDE", label: "Special Developmental (SDE)" },
  { value: "SPE", label: "Special Preparatory (SPE)" },
  { value: "GPE", label: "General Preparatory (GPE)" },
];

const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const ATHLETE_TYPE_OPTIONS = [
  { value: "EXPLOSIVE", label: "Explosive" },
  { value: "SPEED_STRENGTH", label: "Speed Strength" },
  { value: "STRENGTH_SPEED", label: "Strength Speed" },
  { value: "STRENGTH", label: "Strength" },
];

const EMPTY: DrillData = {
  name: "",
  description: "",
  videoUrl: "",
  event: null,
  category: "GPE",
  implementKg: "",
  difficulty: null,
  cues: [""],
  athleteTypes: [],
};

/* ─── Component ──────────────────────────────────────────────────────────── */

export function DrillFormModal({ open, onClose, editDrill }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<DrillData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editDrill;

  // Populate form when editing
  useEffect(() => {
    if (editDrill) {
      setForm({
        id: editDrill.id,
        name: editDrill.name,
        description: editDrill.description ?? "",
        videoUrl: editDrill.videoUrl ?? "",
        event: editDrill.event,
        category: editDrill.category,
        implementKg: editDrill.implementKg?.toString() ?? "",
        difficulty: editDrill.difficulty,
        cues: editDrill.cues.length > 0 ? editDrill.cues : [""],
        athleteTypes: editDrill.athleteTypes,
      });
    } else {
      setForm(EMPTY);
    }
    setError(null);
  }, [editDrill, open]);

  function updateField(key: keyof DrillData, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addCue() {
    setForm((prev) => ({ ...prev, cues: [...prev.cues, ""] }));
  }

  function updateCue(index: number, value: string) {
    setForm((prev) => {
      const cues = [...prev.cues];
      cues[index] = value;
      return { ...prev, cues };
    });
  }

  function removeCue(index: number) {
    setForm((prev) => ({
      ...prev,
      cues: prev.cues.filter((_, i) => i !== index),
    }));
  }

  function toggleAthleteType(type: string) {
    setForm((prev) => ({
      ...prev,
      athleteTypes: prev.athleteTypes.includes(type)
        ? prev.athleteTypes.filter((t) => t !== type)
        : [...prev.athleteTypes, type],
    }));
  }

  async function handleSave() {
    setError(null);
    setSaving(true);

    const payload = {
      name: form.name,
      description: form.description || null,
      videoUrl: form.videoUrl || null,
      event: form.event,
      category: form.category,
      implementKg: form.implementKg ? parseFloat(form.implementKg) : null,
      difficulty: form.difficulty,
      cues: form.cues.filter((c) => c.trim()),
      athleteTypes: form.athleteTypes,
    };

    try {
      const url = isEdit
        ? `/api/coach/throws/drills/${editDrill!.id}`
        : "/api/coach/throws/drills";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save drill");
        return;
      }

      router.refresh();
      onClose();
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Drill" : "Add Drill"}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {isEdit ? "Save Changes" : "Create Drill"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Name */}
        <Input
          label="Drill Name"
          required
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
          placeholder="e.g., Standing Throw"
        />

        {/* Category + Event row */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label="Category"
            required
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={(v) => updateField("category", v)}
          />
          <Select
            label="Event"
            options={EVENT_OPTIONS}
            value={form.event}
            onChange={(v) => updateField("event", v)}
            placeholder="Any event"
            clearable
          />
        </div>

        {/* Difficulty + Implement */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label="Difficulty"
            options={DIFFICULTY_OPTIONS}
            value={form.difficulty}
            onChange={(v) => updateField("difficulty", v)}
            placeholder="Any level"
            clearable
          />
          <Input
            label="Implement Weight (kg)"
            type="number"
            step="0.01"
            value={form.implementKg}
            onChange={(e) => updateField("implementKg", e.target.value)}
            placeholder="e.g., 7.26"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[var(--foreground)]">
            Description
          </label>
          <textarea
            className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 resize-y min-h-[80px]"
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="Describe the drill…"
            rows={3}
          />
        </div>

        {/* Video URL */}
        <Input
          label="Video URL"
          type="url"
          value={form.videoUrl}
          onChange={(e) => updateField("videoUrl", e.target.value)}
          placeholder="https://…"
        />

        {/* Cues */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--foreground)]">
            Coaching Cues
          </label>
          {form.cues.map((cue, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={cue}
                onChange={(e) => updateCue(i, e.target.value)}
                placeholder={`Cue ${i + 1}`}
              />
              {form.cues.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCue(i)}
                  className="px-2 text-muted hover:text-red-500 transition-colors shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addCue}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            + Add cue
          </button>
        </div>

        {/* Athlete Types (checkboxes) */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--foreground)]">
            Recommended for Athlete Types
          </label>
          <div className="flex flex-wrap gap-2">
            {ATHLETE_TYPE_OPTIONS.map((opt) => {
              const checked = form.athleteTypes.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleAthleteType(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    checked
                      ? "bg-primary-500/15 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30"
                      : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted">
            Leave empty if the drill applies to all types.
          </p>
        </div>
      </div>
    </Modal>
  );
}
