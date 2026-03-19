"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { validateImplementSequence, validateCrossBlockSequence } from "@/lib/bondarchuk";
import type { BlockData, BlockExerciseData } from "./_step-blocks";
import type { ExerciseItem } from "@/lib/data/coach";
import { formatImplementWeight } from "@/lib/throws";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const CATEGORY_BADGE: Record<string, "danger" | "warning" | "neutral" | "success"> = {
  CE: "danger",
  SDE: "warning",
  SPE: "neutral",
  GPE: "success",
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function StepExercises({
  blocks,
  onChange,
  exercises,
  eventFilter,
}: {
  blocks: BlockData[];
  onChange: (blocks: BlockData[]) => void;
  exercises: ExerciseItem[];
  eventFilter: string;
}) {
  const [activeBlockIdx, setActiveBlockIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const activeBlock = blocks[activeBlockIdx];

  // Filter exercises based on block type, event, and search
  const filteredExercises = useMemo(() => {
    let result = exercises;

    // Filter by event if set
    if (eventFilter) {
      result = result.filter((e) => !e.event || e.event === eventFilter);
    }

    // Filter by block type context
    if (activeBlock?.blockType === "throwing") {
      result = result.filter((e) => e.category === "CE" || e.category === "SDE");
    } else if (activeBlock?.blockType === "strength") {
      result = result.filter((e) => e.category === "GPE" || e.category === "SPE");
    }
    // warmup/cooldown shows all

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.event && formatEventName(e.event).toLowerCase().includes(q)) ||
          (e.equipment && e.equipment.toLowerCase().includes(q))
      );
    }

    return result;
  }, [exercises, eventFilter, activeBlock?.blockType, searchQuery]);

  // Bondarchuk validation for implement sequencing
  const implementValidation = useMemo(() => {
    const blockInputs = blocks.map((b) => ({
      name: b.name,
      blockType: b.blockType,
      exercises: b.exercises.map((e) => ({
        name: e.exerciseName,
        implementKg: e.implementKg || null,
      })),
    }));
    const seqResult = validateImplementSequence(blockInputs);
    const crossResult = validateCrossBlockSequence(blockInputs);
    return {
      valid: seqResult.valid && crossResult.valid,
      warnings: [...seqResult.warnings, ...crossResult.warnings],
    };
  }, [blocks]);

  function addExercise(exercise: ExerciseItem) {
    const newExercise: BlockExerciseData = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      exerciseCategory: exercise.category,
      sets: exercise.defaultSets ?? 3,
      reps: exercise.defaultReps ?? "",
      weight: "",
      rpe: 0,
      restSeconds: activeBlock?.blockType === "throwing" ? 60 : 90,
      notes: "",
      implementKg: exercise.implementWeight ?? 0,
    };

    const updated = blocks.map((b, i) =>
      i === activeBlockIdx ? { ...b, exercises: [...b.exercises, newExercise] } : b
    );
    onChange(updated);
  }

  function removeExercise(exIdx: number) {
    const updated = blocks.map((b, i) =>
      i === activeBlockIdx
        ? { ...b, exercises: b.exercises.filter((_, j) => j !== exIdx) }
        : b
    );
    onChange(updated);
  }

  function updateExercise(exIdx: number, update: Partial<BlockExerciseData>) {
    const updated = blocks.map((b, i) =>
      i === activeBlockIdx
        ? {
            ...b,
            exercises: b.exercises.map((e, j) => (j === exIdx ? { ...e, ...update } : e)),
          }
        : b
    );
    onChange(updated);
  }

  function moveExercise(exIdx: number, dir: -1 | 1) {
    const target = exIdx + dir;
    if (!activeBlock || target < 0 || target >= activeBlock.exercises.length) return;
    const updated = blocks.map((b, i) => {
      if (i !== activeBlockIdx) return b;
      const exs = [...b.exercises];
      [exs[exIdx], exs[target]] = [exs[target], exs[exIdx]];
      return { ...b, exercises: exs };
    });
    onChange(updated);
  }

  if (!activeBlock) return null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Configure Exercises</h2>
        <p className="text-sm text-muted mt-1">
          Add exercises to each block. For throwing blocks, implements should descend in weight.
        </p>
      </div>

      {/* Bondarchuk implement warnings */}
      {!implementValidation.valid && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 space-y-1">
          {implementValidation.warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">
                {w.severity === "error" ? "!!" : "!"}
              </span>
              {w.message}
            </p>
          ))}
        </div>
      )}

      {/* Block tabs */}
      <div className="flex flex-wrap gap-1">
        {blocks.map((block, idx) => (
          <button
            key={idx}
            onClick={() => setActiveBlockIdx(idx)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              idx === activeBlockIdx
                ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30"
                : "text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
            }`}
          >
            {block.name || `Block ${idx + 1}`}
            <span className="ml-1.5 text-xs opacity-60">{block.exercises.length}</span>
          </button>
        ))}
      </div>

      {/* Two-column layout: exercise list + current block exercises */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Exercise picker */}
        <div className="space-y-3">
          <div className="relative">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exercises..."
              className="input pl-9 w-full"
            />
          </div>

          <div className="max-h-[40vh] min-h-[160px] overflow-y-auto space-y-1 pr-1">
            {filteredExercises.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No matching exercises.</p>
            ) : (
              filteredExercises.map((exercise) => (
                <button
                  key={exercise.id}
                  onClick={() => addExercise(exercise)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {exercise.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={CATEGORY_BADGE[exercise.category] ?? "neutral"}>
                          {exercise.category}
                        </Badge>
                        {exercise.event && (
                          <span className="text-xs text-muted">{formatEventName(exercise.event)}</span>
                        )}
                        {exercise.implementWeight && (
                          <span className="text-xs text-muted tabular-nums">{formatImplementWeight(exercise.implementWeight)}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      + Add
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Current block exercises */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            {activeBlock.name || `Block ${activeBlockIdx + 1}`} — Exercises
          </h3>

          {activeBlock.exercises.length === 0 ? (
            <div className="border-2 border-dashed border-[var(--card-border)] rounded-xl p-6 text-center">
              <p className="text-sm text-muted">Click exercises on the left to add them.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeBlock.exercises.map((ex, exIdx) => (
                <div
                  key={`${ex.exerciseId}-${exIdx}`}
                  className="border border-[var(--card-border)] rounded-lg p-3 space-y-2 bg-surface-50 dark:bg-surface-900/50"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted font-mono w-5 shrink-0">{exIdx + 1}.</span>
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {ex.exerciseName}
                      </p>
                      {ex.implementKg > 0 && (
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums shrink-0">
                          {ex.implementKg}kg
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => moveExercise(exIdx, -1)}
                        disabled={exIdx === 0}
                        className="p-0.5 rounded hover:bg-surface-200 dark:hover:bg-surface-800 disabled:opacity-30"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                      </button>
                      <button
                        onClick={() => moveExercise(exIdx, 1)}
                        disabled={exIdx === activeBlock.exercises.length - 1}
                        className="p-0.5 rounded hover:bg-surface-200 dark:hover:bg-surface-800 disabled:opacity-30"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                      </button>
                      <button
                        onClick={() => removeExercise(exIdx)}
                        className="p-0.5 rounded hover:bg-red-500/10 text-red-500 ml-1"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  </div>

                  {/* Config row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Input
                      label="Sets"
                      type="number"
                      value={ex.sets ? ex.sets.toString() : ""}
                      onChange={(e) =>
                        updateExercise(exIdx, { sets: parseInt(e.target.value, 10) || 0 })
                      }
                      min={1}
                    />
                    <Input
                      label="Reps"
                      placeholder="5"
                      value={ex.reps}
                      onChange={(e) => updateExercise(exIdx, { reps: e.target.value })}
                    />
                    {activeBlock.blockType === "throwing" ? (
                      <Input
                        label="Implement (kg)"
                        type="number"
                        value={ex.implementKg ? ex.implementKg.toString() : ""}
                        onChange={(e) =>
                          updateExercise(exIdx, { implementKg: parseFloat(e.target.value) || 0 })
                        }
                        min={0}
                        step={0.01}
                      />
                    ) : (
                      <Input
                        label="Weight"
                        placeholder="80kg"
                        value={ex.weight}
                        onChange={(e) => updateExercise(exIdx, { weight: e.target.value })}
                      />
                    )}
                    <Input
                      label="Rest (sec)"
                      type="number"
                      value={ex.restSeconds ? ex.restSeconds.toString() : ""}
                      onChange={(e) =>
                        updateExercise(exIdx, { restSeconds: parseInt(e.target.value, 10) || 0 })
                      }
                      min={0}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
