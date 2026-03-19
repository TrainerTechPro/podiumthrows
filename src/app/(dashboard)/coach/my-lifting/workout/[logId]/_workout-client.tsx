"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";
import { Button } from "@/components/ui/Button";
import { ExerciseRow } from "./_exercise-row";
import { ExerciseHistoryDrawer } from "./_exercise-history-drawer";
import { AddExerciseModal } from "./_add-exercise-modal";
import type { ExerciseLogState } from "./_exercise-row";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface ProgramExercise {
  prescribedSets: number;
  prescribedReps: string | null;
  prescribedDuration: string | null;
  isIsometric: boolean;
}

interface ExerciseLogFromServer {
  id: string;
  exerciseName: string;
  order: number;
  sets: number | null;
  reps: number | null;
  load: number | null;
  loadUnit: string;
  duration: number | null;
  isSkipped: boolean;
  isAdded: boolean;
  isModified: boolean;
  previousLoad: number | null;
  notes: string | null;
  programExerciseId: string | null;
  programExercise: ProgramExercise | null;
}

interface WorkoutLogData {
  id: string;
  weekNumber: number;
  workoutNumber: number;
  targetRpe: string | null;
  actualRpe: number | null;
  status: string;
  notes: string | null;
  date: string;
  program: { name: string; rpeTargets: string | null };
  phase: { name: string; method: string } | null;
  exerciseLogs: ExerciseLogFromServer[];
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

/* ─── RPE Color Map ──────────────────────────────────────────────────────── */

const RPE_BADGE_COLORS: Record<number, string> = {
  1: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
  2: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  3: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
  4: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
};

function getRpeBadgeClass(workoutNumber: number) {
  return RPE_BADGE_COLORS[workoutNumber] ?? RPE_BADGE_COLORS[4];
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function parseRpeTargets(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function serverLogToState(log: ExerciseLogFromServer): ExerciseLogState {
  return {
    id: log.id,
    exerciseName: log.exerciseName,
    order: log.order,
    sets: log.sets,
    reps: log.reps,
    load: log.load,
    loadUnit: log.loadUnit,
    duration: log.duration,
    isSkipped: log.isSkipped,
    isAdded: log.isAdded,
    isModified: log.isModified,
    previousLoad: log.previousLoad,
    notes: log.notes,
    programExerciseId: log.programExerciseId,
  };
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function WorkoutClient({ workoutLog }: { workoutLog: WorkoutLogData }) {
  const router = useRouter();

  /* ── State ──────────────────────────────────────────────────────────── */
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLogState[]>(() =>
    workoutLog.exerciseLogs.map(serverLogToState)
  );
  const [status, setStatus] = useState(workoutLog.status);
  const [notes, setNotes] = useState(workoutLog.notes ?? "");
  const [actualRpe, setActualRpe] = useState<number | null>(
    workoutLog.actualRpe
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [historyExercise, setHistoryExercise] = useState<string | null>(null);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  /* ── Prescribed data map (keyed by exercise log id) ────────────────── */
  const prescribedMap = useRef(
    new Map<string, ProgramExercise | null>(
      workoutLog.exerciseLogs.map((l) => [l.id, l.programExercise])
    )
  );

  /* ── Debounced auto-save ───────────────────────────────────────────── */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(
    async (logs: ExerciseLogState[], noteText: string) => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/lifting/workouts/${workoutLog.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            exerciseLogs: logs,
            notes: noteText || null,
          }),
        });
        if (!res.ok) throw new Error("Save failed");
        setSaveStatus("saved");

        // Clear "Saved" after 2s
        if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
        savedFadeRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    },
    [workoutLog.id]
  );

  // Trigger debounced save on exercise or notes changes
  const scheduleSave = useCallback(
    (logs: ExerciseLogState[], noteText: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => doSave(logs, noteText), 1500);
    },
    [doSave]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
    };
  }, []);

  /* ── Handlers ───────────────────────────────────────────────────────── */

  function handleExerciseChange(index: number, updated: ExerciseLogState) {
    setExerciseLogs((prev) => {
      const next = [...prev];
      next[index] = updated;
      scheduleSave(next, notes);
      return next;
    });
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    scheduleSave(exerciseLogs, value);
  }

  function handleAddExercise(name: string) {
    const nextOrder =
      exerciseLogs.length > 0
        ? Math.max(...exerciseLogs.map((l) => l.order)) + 1
        : 0;

    const newLog: ExerciseLogState = {
      id: "", // empty id signals creation on the API side
      exerciseName: name,
      order: nextOrder,
      sets: null,
      reps: null,
      load: null,
      loadUnit: "lbs",
      duration: null,
      isSkipped: false,
      isAdded: true,
      isModified: false,
      previousLoad: null,
      notes: null,
      programExerciseId: null,
    };

    setExerciseLogs((prev) => {
      const next = [...prev, newLog];
      scheduleSave(next, notes);
      return next;
    });
  }

  async function handleComplete() {
    setIsCompleting(true);
    // Cancel any pending auto-save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    try {
      const res = await fetch(`/api/lifting/workouts/${workoutLog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          status: "COMPLETED",
          actualRpe,
          notes: notes || null,
          exerciseLogs,
        }),
      });
      if (!res.ok) throw new Error("Failed to complete workout");
      setStatus("COMPLETED");
      router.push("/coach/my-lifting");
    } catch {
      setSaveStatus("error");
      setIsCompleting(false);
    }
  }

  /* ── Derived ────────────────────────────────────────────────────────── */
  const rpeTargets = parseRpeTargets(workoutLog.program.rpeTargets);
  const targetRpe =
    workoutLog.targetRpe ??
    rpeTargets[workoutLog.workoutNumber - 1] ??
    null;
  const isCompleted = status === "COMPLETED";

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className="max-w-2xl mx-auto pb-32">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/coach/my-lifting"
            className="shrink-0 p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 dark:hover:text-surface-200 transition-colors"
            aria-label="Back to My Lifting"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>

          <div className="min-w-0">
            <h1 className="text-lg font-heading font-bold text-surface-900 dark:text-surface-100 truncate">
              Week {workoutLog.weekNumber}, Workout {workoutLog.workoutNumber}
            </h1>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              {targetRpe && (
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    getRpeBadgeClass(workoutLog.workoutNumber)
                  )}
                >
                  RPE {targetRpe}
                </span>
              )}
              {workoutLog.phase && (
                <span className="text-xs text-surface-400 dark:text-surface-500">
                  {workoutLog.phase.method}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Save status */}
        <div className="shrink-0 text-xs">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-surface-400">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              Saving...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-green-500">
              <CheckCircle2 size={12} aria-hidden="true" />
              Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-danger-500">Save failed</span>
          )}
          {isCompleted && (
            <span className="flex items-center gap-1 text-green-500 font-medium">
              <CheckCircle2 size={14} aria-hidden="true" />
              Completed
            </span>
          )}
        </div>
      </div>

      {/* ── Exercise List ────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 divide-y divide-surface-100 dark:divide-surface-800">
        {exerciseLogs.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-surface-400 dark:text-surface-500">
              No exercises yet. Add one to get started.
            </p>
          </div>
        )}

        {exerciseLogs.map((log, i) => (
          <ExerciseRow
            key={log.id || `added-${i}`}
            index={i}
            log={log}
            prescribed={prescribedMap.current.get(log.id) ?? null}
            onChange={(updated) => handleExerciseChange(i, updated)}
            onNameClick={(name) => setHistoryExercise(name)}
          />
        ))}
      </div>

      {/* ── Bottom Sticky Bar ────────────────────────────────────────── */}
      {!isCompleted && (
        <div className="fixed bottom-0 inset-x-0 bg-white/80 dark:bg-surface-900/80 backdrop-blur-lg border-t border-surface-200 dark:border-surface-700 z-30">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3 px-4 py-3">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Plus size={14} aria-hidden="true" />}
              onClick={() => setShowAddExercise(true)}
            >
              Add Exercise
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCompleteModal(true)}
            >
              Complete Workout
            </Button>
          </div>
        </div>
      )}

      {/* ── Complete Workout Modal ───────────────────────────────────── */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[6px]"
            onClick={() => !isCompleting && setShowCompleteModal(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-heading font-semibold text-surface-900 dark:text-surface-100 mb-4">
              Complete Workout
            </h2>

            {/* RPE input */}
            <div className="mb-4">
              <label
                htmlFor="actual-rpe"
                className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5"
              >
                How hard was this workout? (RPE 1-10)
              </label>
              <input
                id="actual-rpe"
                type="number"
                min={1}
                max={10}
                step={0.5}
                value={actualRpe ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : parseFloat(e.target.value);
                  setActualRpe(v);
                }}
                placeholder="e.g. 7"
                className="w-full bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
              />
            </div>

            {/* Notes */}
            <div className="mb-5">
              <label
                htmlFor="workout-notes"
                className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5"
              >
                Notes (optional)
              </label>
              <textarea
                id="workout-notes"
                rows={3}
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="How did it feel? Anything to note..."
                className="w-full bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCompleteModal(false)}
                disabled={isCompleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleComplete}
                loading={isCompleting}
              >
                Save &amp; Complete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── History Drawer ───────────────────────────────────────────── */}
      <ExerciseHistoryDrawer
        exerciseName={historyExercise}
        onClose={() => setHistoryExercise(null)}
      />

      {/* ── Add Exercise Modal ───────────────────────────────────────── */}
      <AddExerciseModal
        isOpen={showAddExercise}
        onClose={() => setShowAddExercise(false)}
        onAdd={handleAddExercise}
      />
    </div>
  );
}
