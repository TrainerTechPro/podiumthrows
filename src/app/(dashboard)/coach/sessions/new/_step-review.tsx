"use client";

import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { validateFullSession } from "@/lib/bondarchuk";
import type { BasicsData } from "./_step-basics";
import type { BlockData } from "./_step-blocks";
import type { ExerciseItem, AthletePickerItem } from "@/lib/data/coach";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const TYPE_BADGE: Record<string, "danger" | "warning" | "success" | "neutral"> = {
  throwing: "danger",
  strength: "success",
  warmup: "neutral",
  cooldown: "neutral",
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function StepReview({
  basics,
  blocks,
  exercises: _exercises,
  athletes,
  isTemplate,
  onIsTemplateChange,
  selectedAthletes,
  onSelectedAthletesChange,
  scheduledDate,
  onScheduledDateChange,
  coachNotes,
  onCoachNotesChange,
}: {
  basics: BasicsData;
  blocks: BlockData[];
  exercises: ExerciseItem[];
  athletes: AthletePickerItem[];
  isTemplate: boolean;
  onIsTemplateChange: (v: boolean) => void;
  selectedAthletes: string[];
  onSelectedAthletesChange: (ids: string[]) => void;
  scheduledDate: string;
  onScheduledDateChange: (date: string) => void;
  coachNotes: string;
  onCoachNotesChange: (notes: string) => void;
}) {
  // Bondarchuk validation
  const validation = validateFullSession(
    blocks.map((b) => ({
      name: b.name,
      blockType: b.blockType,
      exercises: b.exercises.map((e) => ({
        name: e.exerciseName,
        implementKg: e.implementKg || null,
      })),
    }))
  );

  const totalExercises = blocks.reduce((sum, b) => sum + b.exercises.length, 0);
  const throwingBlocks = blocks.filter((b) => b.blockType === "throwing");

  function toggleAthlete(id: string) {
    onSelectedAthletesChange(
      selectedAthletes.includes(id)
        ? selectedAthletes.filter((a) => a !== id)
        : [...selectedAthletes, id]
    );
  }

  function selectAll() {
    onSelectedAthletesChange(athletes.map((a) => a.id));
  }

  function selectNone() {
    onSelectedAthletesChange([]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Review & Save</h2>
        <p className="text-sm text-muted mt-1">Review your session, then save or assign to athletes.</p>
      </div>

      {/* Session Summary */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[var(--foreground)]">{basics.name}</h3>
          {basics.event && <Badge variant="neutral">{formatEventName(basics.event)}</Badge>}
        </div>
        {basics.description && (
          <p className="text-sm text-muted">{basics.description}</p>
        )}
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-muted">Blocks:</span>{" "}
            <span className="font-medium">{blocks.length}</span>
          </div>
          <div>
            <span className="text-muted">Exercises:</span>{" "}
            <span className="font-medium">{totalExercises}</span>
          </div>
          {throwingBlocks.length > 0 && (
            <div>
              <span className="text-muted">Throwing Blocks:</span>{" "}
              <span className="font-medium">{throwingBlocks.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bondarchuk Compliance */}
      <div className={`rounded-lg border px-4 py-3 ${
        validation.valid
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-amber-500/30 bg-amber-500/10"
      }`}>
        <div className="flex items-center gap-2 mb-1">
          {validation.valid ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                Bondarchuk Compliant
              </span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Warnings — Review Before Saving
              </span>
            </>
          )}
        </div>
        {!validation.valid && (
          <div className="space-y-1 mt-2">
            {validation.warnings.map((w, i) => (
              <p key={i} className="text-sm text-amber-700 dark:text-amber-400">
                {w.message}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Block breakdown */}
      <div className="space-y-2">
        {blocks.map((block, idx) => (
          <div key={idx} className="border border-[var(--card-border)] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={TYPE_BADGE[block.blockType] ?? "neutral"}>
                {block.blockType}
              </Badge>
              <span className="text-sm font-medium text-[var(--foreground)]">{block.name}</span>
              {block.restSeconds > 0 && (
                <span className="text-xs text-muted ml-auto">{block.restSeconds}s rest</span>
              )}
            </div>
            {block.exercises.length === 0 ? (
              <p className="text-xs text-muted">No exercises</p>
            ) : (
              <div className="space-y-1">
                {block.exercises.map((ex, exIdx) => (
                  <div key={exIdx} className="flex items-center gap-3 text-sm">
                    <span className="text-xs text-muted w-4 shrink-0">{exIdx + 1}.</span>
                    <span className="text-[var(--foreground)]">{ex.exerciseName}</span>
                    {ex.sets > 0 && (
                      <span className="text-muted tabular-nums">
                        {ex.sets}{ex.reps ? `×${ex.reps}` : " sets"}
                      </span>
                    )}
                    {ex.implementKg > 0 && (
                      <span className="text-amber-600 dark:text-amber-400 font-bold tabular-nums text-xs">
                        {ex.implementKg}kg
                      </span>
                    )}
                    {ex.weight && (
                      <span className="text-muted tabular-nums text-xs">{ex.weight}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Save as template toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isTemplate}
          onChange={(e) => onIsTemplateChange(e.target.checked)}
          className="rounded border-surface-300 text-primary-500 focus:ring-primary-500"
        />
        <div>
          <span className="text-sm font-medium text-[var(--foreground)]">Save as Template</span>
          <p className="text-xs text-muted">Templates can be reused and cloned for future sessions.</p>
        </div>
      </label>

      {/* Assign to Athletes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wider">
            Assign to Athletes
          </h3>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-xs text-primary-500 hover:underline">Select All</button>
            <button onClick={selectNone} className="text-xs text-muted hover:underline">Clear</button>
          </div>
        </div>

        {athletes.length === 0 ? (
          <p className="text-sm text-muted">No athletes on your roster yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
            {athletes.map((athlete) => {
              const selected = selectedAthletes.includes(athlete.id);
              return (
                <button
                  key={athlete.id}
                  onClick={() => toggleAthlete(athlete.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                    selected
                      ? "bg-primary-500/10 ring-1 ring-primary-500/30"
                      : "hover:bg-surface-100 dark:hover:bg-surface-800"
                  }`}
                >
                  <Avatar
                    name={`${athlete.firstName} ${athlete.lastName}`}
                    src={athlete.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">
                      {athlete.firstName} {athlete.lastName}
                    </p>
                  </div>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                    selected
                      ? "bg-primary-500 border-primary-500"
                      : "border-surface-300 dark:border-surface-600"
                  }`}>
                    {selected && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedAthletes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Scheduled Date"
              type="date"
              value={scheduledDate}
              onChange={(e) => onScheduledDateChange(e.target.value)}
              required
            />
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Coach Notes <span className="text-muted font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Notes visible to athletes..."
                value={coachNotes}
                onChange={(e) => onCoachNotesChange(e.target.value)}
                className="input w-full resize-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
