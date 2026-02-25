"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, RestTimer } from "@/components";
import { PRCelebration } from "@/components/ui/PRCelebration";
import type {
  SessionWithPrescription,
  PrescribedBlock,
  PrescribedExercise,
} from "@/lib/data/athlete";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type LoggedSet = {
  exerciseName: string;
  sets: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  distance: number | null;
};

const TYPE_BADGE: Record<string, "danger" | "warning" | "success" | "neutral"> = {
  throwing: "danger",
  strength: "success",
  warmup: "neutral",
  cooldown: "neutral",
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function SessionLogger({ session }: { session: SessionWithPrescription }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loggedExercises, setLoggedExercises] = useState<Map<string, LoggedSet>>(
    () => {
      // Initialize from existing logs
      const map = new Map<string, LoggedSet>();
      for (const log of session.logs) {
        map.set(log.exerciseName, {
          exerciseName: log.exerciseName,
          sets: log.sets,
          reps: log.reps,
          weight: log.weight,
          rpe: log.rpe,
          distance: log.distance,
        });
      }
      return map;
    }
  );
  const [activeRest, setActiveRest] = useState<number | null>(null);
  const [prAlerts, setPrAlerts] = useState<string[]>([]);
  const [prCelebration, setPrCelebration] = useState<{
    show: boolean;
    event?: string;
    distance?: number;
  }>({ show: false });

  const dismissPrCelebration = useCallback(() => {
    setPrCelebration({ show: false });
  }, []);

  const allExercises = session.blocks.flatMap((b) => b.exercises);
  const loggedCount = loggedExercises.size;
  const totalCount = allExercises.length;
  const progress = totalCount > 0 ? (loggedCount / totalCount) * 100 : 0;

  async function handleLogExercise(
    exercise: PrescribedExercise,
    block: PrescribedBlock,
    values: { sets: number; reps: number | null; weight: number | null; rpe: number | null; distance: number | null }
  ) {
    setError(null);

    const isThrowingBlock = block.blockType === "throwing";
    const isThrow = isThrowingBlock && (exercise.exerciseCategory === "CE" || exercise.exerciseCategory === "SDE");

    startTransition(async () => {
      try {
        const res = await fetch(`/api/athlete/sessions/${session.id}/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exerciseName: exercise.exerciseName,
            sets: values.sets,
            reps: values.reps,
            weight: values.weight,
            rpe: values.rpe,
            distance: values.distance,
            isThrow,
            event: isThrow ? session.planName?.toUpperCase()?.replace(/ /g, "_") : undefined,
            implementKg: exercise.implementKg,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to log exercise.");
          return;
        }

        const data = await res.json();

        // Update local state
        setLoggedExercises((prev) => {
          const next = new Map(prev);
          next.set(exercise.exerciseName, {
            exerciseName: exercise.exerciseName,
            ...values,
          });
          return next;
        });

        // Check for PR
        if (data.throwLog?.isPersonalBest) {
          setPrAlerts((prev) => [...prev, exercise.exerciseName]);
          setTimeout(() => {
            setPrAlerts((prev) => prev.filter((n) => n !== exercise.exerciseName));
          }, 5000);
          // Show confetti celebration
          setPrCelebration({
            show: true,
            event: data.throwLog.event ?? undefined,
            distance: data.throwLog.distance ?? undefined,
          });
        }

        // Start rest timer if exercise has rest seconds
        if (exercise.restSeconds && exercise.restSeconds > 0) {
          setActiveRest(exercise.restSeconds);
        }

        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* PR Celebration overlay */}
      <PRCelebration
        show={prCelebration.show}
        onDismiss={dismissPrCelebration}
        event={prCelebration.event}
        distance={prCelebration.distance}
      />

      {/* Progress bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Session Progress
          </span>
          <span className="text-sm text-muted tabular-nums">
            {loggedCount} / {totalCount} exercises
          </span>
        </div>
        <div className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* PR alerts */}
      {prAlerts.map((name) => (
        <div
          key={name}
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-center gap-2 animate-[fadeIn_150ms_ease]"
        >
          <span className="text-lg">&#127942;</span>
          <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Personal Record on {name}!
          </span>
        </div>
      ))}

      {/* Rest timer (floating) */}
      {activeRest !== null && activeRest > 0 && (
        <div className="card p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--foreground)]">Rest Timer</span>
          <RestTimer
            seconds={activeRest}
            autoStart
            compact
            onComplete={() => setActiveRest(null)}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Blocks */}
      {session.blocks.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-muted text-sm">No prescribed workout for this session.</p>
          <p className="text-muted text-xs mt-1">Use the complete button to mark this session done.</p>
        </div>
      ) : (
        session.blocks.map((block) => (
          <BlockCard
            key={block.id}
            block={block}
            loggedExercises={loggedExercises}
            onLog={(ex, vals) => handleLogExercise(ex, block, vals)}
            isPending={isPending}
          />
        ))
      )}
    </div>
  );
}

/* ─── Block Card ──────────────────────────────────────────────────────────── */

function BlockCard({
  block,
  loggedExercises,
  onLog,
  isPending,
}: {
  block: PrescribedBlock;
  loggedExercises: Map<string, LoggedSet>;
  onLog: (
    ex: PrescribedExercise,
    vals: { sets: number; reps: number | null; weight: number | null; rpe: number | null; distance: number | null }
  ) => void;
  isPending: boolean;
}) {
  return (
    <div className="card overflow-hidden">
      {/* Block header */}
      <div className="px-4 py-3 bg-surface-50 dark:bg-surface-800/50 border-b border-[var(--card-border)] flex items-center gap-2">
        <Badge variant={TYPE_BADGE[block.blockType] ?? "neutral"}>
          {block.blockType}
        </Badge>
        <span className="text-sm font-semibold text-[var(--foreground)]">{block.name}</span>
        {block.restSeconds != null && block.restSeconds > 0 && (
          <span className="text-xs text-muted ml-auto">{block.restSeconds}s rest between exercises</span>
        )}
      </div>

      {/* Exercises */}
      {block.exercises.length === 0 ? (
        <p className="p-4 text-sm text-muted">No exercises in this block.</p>
      ) : (
        <div className="divide-y divide-[var(--card-border)]">
          {block.exercises.map((exercise) => (
            <ExerciseRow
              key={exercise.id}
              exercise={exercise}
              logged={loggedExercises.get(exercise.exerciseName) ?? null}
              onLog={(vals) => onLog(exercise, vals)}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Exercise Row ────────────────────────────────────────────────────────── */

function ExerciseRow({
  exercise,
  logged,
  onLog,
  isPending,
}: {
  exercise: PrescribedExercise;
  logged: LoggedSet | null;
  onLog: (vals: { sets: number; reps: number | null; weight: number | null; rpe: number | null; distance: number | null }) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [sets, setSets] = useState(exercise.sets ?? 3);
  const [reps, setReps] = useState(exercise.reps ?? "");
  const [weight, setWeight] = useState(exercise.weight ?? "");
  const [rpe, setRpe] = useState("");
  const [distance, setDistance] = useState("");

  const isLogged = logged !== null;

  function handleSubmit() {
    onLog({
      sets,
      reps: reps ? parseInt(reps, 10) || null : null,
      weight: weight ? parseFloat(weight) || null : null,
      rpe: rpe ? parseFloat(rpe) || null : null,
      distance: distance ? parseFloat(distance) || null : null,
    });
    setExpanded(false);
  }

  return (
    <div className="px-4 py-3">
      {/* Summary row */}
      <div className="flex items-center gap-3">
        {/* Checkbox indicator */}
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
            isLogged
              ? "bg-emerald-500 border-emerald-500"
              : "border-surface-300 dark:border-surface-600"
          }`}
        >
          {isLogged && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>

        {/* Exercise info */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isLogged ? "text-muted line-through" : "text-[var(--foreground)]"}`}>
            {exercise.exerciseName}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
            {exercise.sets != null && (
              <span>{exercise.sets}{exercise.reps ? `×${exercise.reps}` : " sets"}</span>
            )}
            {exercise.weight && <span>{exercise.weight}</span>}
            {exercise.implementKg != null && exercise.implementKg > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-bold">{exercise.implementKg}kg</span>
            )}
            {exercise.rpe != null && <span>RPE {exercise.rpe}</span>}
            {exercise.distance && <span>{exercise.distance}</span>}
          </div>
        </div>

        {/* Log button */}
        {!isLogged && (
          <Button
            variant={expanded ? "secondary" : "primary"}
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Cancel" : "Log"}
          </Button>
        )}
        {isLogged && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Done</span>
        )}
      </div>

      {/* Expanded log form */}
      {expanded && !isLogged && (
        <div className="mt-3 pl-8 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted block mb-0.5">Sets</label>
              <input
                type="number"
                min={1}
                value={sets}
                onChange={(e) => setSets(parseInt(e.target.value) || 1)}
                className="input w-full text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-0.5">Reps</label>
              <input
                type="text"
                placeholder={exercise.reps ?? "—"}
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className="input w-full text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-0.5">Weight (kg)</label>
              <input
                type="text"
                placeholder={exercise.weight ?? "—"}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="input w-full text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-0.5">RPE</label>
              <input
                type="number"
                min={1}
                max={10}
                step={0.5}
                placeholder={exercise.rpe?.toString() ?? "—"}
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                className="input w-full text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-0.5">Distance (m)</label>
              <input
                type="number"
                step={0.01}
                placeholder={exercise.distance ?? "—"}
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className="input w-full text-sm"
              />
            </div>
          </div>

          {exercise.notes && (
            <p className="text-xs text-muted italic">{exercise.notes}</p>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            loading={isPending}
          >
            Save Log
          </Button>
        </div>
      )}
    </div>
  );
}
