"use client";

import { useState, useMemo } from "react";
import { Search, X, Check, Plus } from "lucide-react";
import type { WizardFormState, ExerciseItem } from "../_wizard";

interface StepPreferencesProps {
  form: WizardFormState;
  update: (field: string, value: unknown) => void;
  errors: Record<string, string>;
  exercises: ExerciseItem[];
}

const CATEGORY_LABELS: Record<string, string> = {
  CE: "Competitive",
  SDE: "Special Developmental",
  SPE: "Special Preparatory",
  GPE: "General Preparatory",
};

function ExerciseSearchSelect({
  label,
  description,
  exercises,
  selected,
  onChange,
}: {
  label: string;
  description: string;
  exercises: ExerciseItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query) return exercises.slice(0, 20); // Show first 20 when no query
    const q = query.toLowerCase();
    return exercises.filter(
      (ex) =>
        ex.name.toLowerCase().includes(q) ||
        CATEGORY_LABELS[ex.category]?.toLowerCase().includes(q) ||
        ex.event?.toLowerCase().includes(q)
    );
  }, [exercises, query]);

  function toggleExercise(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function removeExercise(id: string) {
    onChange(selected.filter((s) => s !== id));
  }

  const selectedExercises = exercises.filter((ex) => selected.includes(ex.id));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
      <p className="text-caption text-surface-700 dark:text-surface-300">{description}</p>

      {/* Selected tags */}
      {selectedExercises.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedExercises.map((ex) => (
            <span
              key={ex.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 text-xs font-medium rounded-lg"
            >
              {ex.name}
              <button
                type="button"
                onClick={() => removeExercise(ex.id)}
                className="hover:text-primary-600 dark:hover:text-primary-200"
                aria-label={`Remove ${ex.name}`}
              >
                <X size={12} strokeWidth={2} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search
          size={16}
          strokeWidth={1.75}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="text"
          className="input w-full pl-9"
          placeholder="Search exercises..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Results */}
      <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--card-border)] divide-y divide-[var(--card-border)]">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">No exercises found</p>
        ) : (
          filtered.map((ex) => {
            const isSelected = selected.includes(ex.id);
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => toggleExercise(ex.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? "bg-primary-50/50 dark:bg-primary-950/20"
                    : "hover:bg-surface-50 dark:hover:bg-surface-800/50"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                    isSelected
                      ? "bg-primary-500 border-primary-500"
                      : "border-surface-300 dark:border-surface-600"
                  }`}
                >
                  {isSelected && (
                    <Check size={10} strokeWidth={3} className="text-white" aria-hidden="true" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--foreground)] truncate">{ex.name}</p>
                  <p className="text-[10px] text-muted">
                    {CATEGORY_LABELS[ex.category] || ex.category}
                    {ex.event && ` \u00B7 ${ex.event.replace("_", " ")}`}
                    {ex.implementWeight && ` \u00B7 ${ex.implementWeight}kg`}
                  </p>
                </div>
                {!isSelected && (
                  <Plus size={14} strokeWidth={1.75} className="text-muted flex-shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function StepPreferences({ form, update, errors: _errors, exercises }: StepPreferencesProps) {
  return (
    <div className="space-y-6 p-1">
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-1">
          Exercise Preferences
        </h2>
        <p className="text-body text-surface-700 dark:text-surface-300">
          Customize which exercises the program includes. The engine will use these as
          constraints when building your sessions.
        </p>
      </div>

      {/* Preferred Exercises */}
      <ExerciseSearchSelect
        label="Preferred Exercises"
        description="Exercises you want included in your program when possible"
        exercises={exercises}
        selected={form.preferredExercises}
        onChange={(ids) => update("preferredExercises", ids)}
      />

      {/* Avoided Exercises */}
      <ExerciseSearchSelect
        label="Exercises to Avoid"
        description="Exercises you want excluded (injury, preference, no equipment)"
        exercises={exercises}
        selected={form.avoidedExercises}
        onChange={(ids) => update("avoidedExercises", ids)}
      />

      {/* Favorite Drills */}
      <ExerciseSearchSelect
        label="Favorite Drills"
        description="Warm-up drills and technique work you enjoy and want included"
        exercises={exercises.filter((ex) => ex.category === "CE" || ex.category === "SDE")}
        selected={form.favoriteDrills}
        onChange={(ids) => update("favoriteDrills", ids)}
      />
    </div>
  );
}
