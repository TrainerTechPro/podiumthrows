"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RestTimer } from "@/components";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import { PRCelebration } from "@/components/ui/PRCelebration";
import { formatEventType } from "@/lib/utils";
import type {
  SessionWithPrescription,
  PrescribedBlock,
  PrescribedExercise,
} from "@/lib/data/athlete";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type LoggedThrow = {
  distance: number;
  throwNumber: number;
};

type LoggedStrengthSet = {
  setNumber: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
};

type ExerciseLogState = {
  throws: LoggedThrow[];
  strengthSets: LoggedStrengthSet[];
  completed: boolean;
  bestDistance: number | null;
};

type FlatExercise = {
  exercise: PrescribedExercise;
  block: PrescribedBlock;
  globalIndex: number;
};

/* ─── Keyframe Animations ─────────────────────────────────────────────────── */

const TIMELINE_STYLES = `
@keyframes tl-tiltShine {
  0%, 100% { background-position: -200% 0; }
  50% { background-position: 200% 0; }
}
@keyframes tl-shimmerSweep {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes tl-dotPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245,158,11,0.4); }
  50% { transform: scale(1.3); box-shadow: 0 0 0 6px rgba(245,158,11,0); }
}
@keyframes tl-throwSlideIn {
  from { opacity: 0; transform: translateX(-12px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes tl-confettiDrift {
  0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
  100% { transform: translateY(60px) rotate(360deg) scale(0.4); opacity: 0; }
}
`;

/* ─── Helper: parse prescription target throws ────────────────────────────── */

function getTargetThrows(exercise: PrescribedExercise): number {
  const sets = exercise.sets ?? 1;
  const reps = exercise.reps ? parseInt(exercise.reps, 10) || 1 : 1;
  return sets * reps;
}

function isThrowingExercise(exercise: PrescribedExercise, block: PrescribedBlock): boolean {
  return (
    block.blockType === "throwing" &&
    (exercise.exerciseCategory === "CE" || exercise.exerciseCategory === "SDE")
  );
}

function getBlockLabel(block: PrescribedBlock, blockIndex: number, blocks: PrescribedBlock[]): string | null {
  // Count how many blocks of this type appear before this one
  const sameTypeBefore = blocks
    .slice(0, blockIndex)
    .filter((b) => b.blockType === block.blockType).length;
  const sameTypeTotal = blocks.filter((b) => b.blockType === block.blockType).length;

  const bt = block.blockType.toUpperCase();
  let label = "";

  if (bt === "THROWING") {
    const num = sameTypeTotal > 1 ? ` ${sameTypeBefore + 1}` : "";
    label = `THROWING BLOCK${num}`;
    // Find the first exercise with implementKg to show in label
    const implEx = block.exercises.find((e) => e.implementKg != null && e.implementKg > 0);
    if (implEx) {
      label += ` \u00B7 ${implEx.implementKg}KG`;
    }
  } else if (bt === "STRENGTH") {
    const num = sameTypeTotal > 1 ? ` ${sameTypeBefore + 1}` : "";
    label = `STRENGTH BLOCK${num}`;
  } else if (bt === "WARMUP") {
    label = "WARM-UP";
  } else if (bt === "COOLDOWN") {
    label = "COOL-DOWN";
  } else {
    label = bt + " BLOCK";
  }

  return label;
}

/* ─── Main Component ──────────────────────────────────────────────────────── */

export function SessionLogger({ session }: { session: SessionWithPrescription }) {
  const router = useRouter();
  const { celebration } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // Build flat exercise list with block references
  const flatExercises: FlatExercise[] = session.blocks.flatMap((block) =>
    block.exercises.map((exercise, _i) => ({
      exercise,
      block,
      globalIndex: 0, // Will be assigned below
    }))
  );
  flatExercises.forEach((fe, i) => {
    fe.globalIndex = i;
  });

  const totalCount = flatExercises.length;

  // Exercise log state keyed by exercise name
  const [exerciseLogs, setExerciseLogs] = useState<Map<string, ExerciseLogState>>(() => {
    const map = new Map<string, ExerciseLogState>();

    // Initialize from existing session logs (strength exercises)
    for (const log of session.logs) {
      map.set(log.exerciseName, {
        throws: [],
        strengthSets: [
          {
            setNumber: 1,
            reps: log.reps,
            weight: log.weight,
            rpe: log.rpe,
          },
        ],
        completed: true,
        bestDistance: log.distance,
      });
    }

    // Initialize from existing throw logs
    // Group throws by exercise name based on throw logs matching blocks
    const throwsByExercise = new Map<string, LoggedThrow[]>();
    for (const block of session.blocks) {
      for (const ex of block.exercises) {
        if (isThrowingExercise(ex, block)) {
          // Match throw logs to this exercise based on implementKg
          const matchingThrows = session.throwLogs
            .filter(
              (tl) =>
                tl.implementWeight === ex.implementKg ||
                (tl.implementWeight == null && ex.implementKg == null)
            )
            .map((tl, i) => ({
              distance: tl.distance,
              throwNumber: i + 1,
            }));
          if (matchingThrows.length > 0) {
            throwsByExercise.set(ex.exerciseName, matchingThrows);
          }
        }
      }
    }

    for (const [name, throws] of throwsByExercise) {
      const best = throws.reduce(
        (max, t) => (t.distance > max ? t.distance : max),
        0
      );
      // Find the exercise to get target throws
      const fe = flatExercises.find((f) => f.exercise.exerciseName === name);
      const target = fe ? getTargetThrows(fe.exercise) : throws.length;
      map.set(name, {
        throws,
        strengthSets: [],
        completed: throws.length >= target,
        bestDistance: best > 0 ? best : null,
      });
    }

    return map;
  });

  // Active exercise tracking — expand the first non-completed exercise
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(() => {
    for (const fe of flatExercises) {
      const state = exerciseLogs.get(fe.exercise.exerciseName);
      if (!state?.completed) return fe.exercise.id;
    }
    return null;
  });

  // Rest timer
  const [activeRest, setActiveRest] = useState<{ seconds: number; key: number } | null>(null);
  const restKeyRef = useRef(0);

  // PR celebration
  const [prCelebration, setPrCelebration] = useState<{
    show: boolean;
    event?: string;
    distance?: number;
  }>({ show: false });

  const dismissPrCelebration = useCallback(() => {
    setPrCelebration({ show: false });
  }, []);

  // Scroll ref for auto-scrolling to active exercise
  const activeCardRef = useRef<HTMLDivElement>(null);

  // Compute progress
  const loggedCount = flatExercises.filter(
    (fe) => exerciseLogs.get(fe.exercise.exerciseName)?.completed
  ).length;
  const progress = totalCount > 0 ? (loggedCount / totalCount) * 100 : 0;

  // Find next exercise after a given one
  const findNextExercise = useCallback(
    (currentId: string): FlatExercise | null => {
      const idx = flatExercises.findIndex((fe) => fe.exercise.id === currentId);
      if (idx === -1 || idx >= flatExercises.length - 1) return null;
      // Find next non-completed exercise
      for (let i = idx + 1; i < flatExercises.length; i++) {
        const state = exerciseLogs.get(flatExercises[i].exercise.exerciseName);
        if (!state?.completed) return flatExercises[i];
      }
      return null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flatExercises.length, exerciseLogs]
  );

  // Auto-scroll to active card
  useEffect(() => {
    if (expandedExerciseId && activeCardRef.current) {
      const timeout = setTimeout(() => {
        activeCardRef.current?.scrollIntoView({
          behavior: shouldReduceMotion ? "auto" : "smooth",
          block: "center",
        });
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [expandedExerciseId, shouldReduceMotion]);

  /* ─── API: Log Exercise ────────────────────────────────────────────────── */

  async function handleLogExercise(
    exercise: PrescribedExercise,
    block: PrescribedBlock,
    values: {
      sets: number;
      reps: number | null;
      weight: number | null;
      rpe: number | null;
      distance: number | null;
    }
  ) {
    setError(null);

    const isThrow = isThrowingExercise(exercise, block);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/athlete/sessions/${session.id}/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            exerciseName: exercise.exerciseName,
            sets: values.sets,
            reps: values.reps,
            weight: values.weight,
            rpe: values.rpe,
            distance: values.distance,
            isThrow,
            event: isThrow
              ? session.planName?.toUpperCase()?.replace(/ /g, "_")
              : undefined,
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
        setExerciseLogs((prev) => {
          const next = new Map(prev);
          const existing = next.get(exercise.exerciseName) ?? {
            throws: [],
            strengthSets: [],
            completed: false,
            bestDistance: null,
          };

          if (isThrow && values.distance != null) {
            const newThrow: LoggedThrow = {
              distance: values.distance,
              throwNumber: existing.throws.length + 1,
            };
            const newThrows = [...existing.throws, newThrow];
            const best = newThrows.reduce(
              (max, t) => (t.distance > max ? t.distance : max),
              0
            );
            const target = getTargetThrows(exercise);
            next.set(exercise.exerciseName, {
              throws: newThrows,
              strengthSets: [],
              completed: newThrows.length >= target,
              bestDistance: best > 0 ? best : null,
            });
          } else {
            const newSet: LoggedStrengthSet = {
              setNumber: existing.strengthSets.length + 1,
              reps: values.reps,
              weight: values.weight,
              rpe: values.rpe,
            };
            const newSets = [...existing.strengthSets, newSet];
            const target = exercise.sets ?? 1;
            next.set(exercise.exerciseName, {
              throws: [],
              strengthSets: newSets,
              completed: newSets.length >= target,
              bestDistance: values.distance,
            });
          }

          return next;
        });

        // Check for PR
        if (data.throwLog?.isPersonalBest) {
          setPrCelebration({
            show: true,
            event: data.throwLog.event ?? undefined,
            distance: data.throwLog.distance ?? undefined,
          });
          celebration("New Personal Best!", {
            description: data.throwLog.event
              ? formatEventType(data.throwLog.event)
              : undefined,
            highlight: data.throwLog.distance
              ? `${data.throwLog.distance.toFixed(2)}m`
              : undefined,
          });
        }

        // Start rest timer if exercise has rest seconds
        if (exercise.restSeconds && exercise.restSeconds > 0) {
          restKeyRef.current += 1;
          setActiveRest({
            seconds: exercise.restSeconds,
            key: restKeyRef.current,
          });
        }

        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  /* ─── Advance to next exercise ─────────────────────────────────────────── */

  function handleAdvanceToNext(currentExerciseId: string) {
    const next = findNextExercise(currentExerciseId);
    setExpandedExerciseId(next?.exercise.id ?? null);
  }

  /* ─── Render ───────────────────────────────────────────────────────────── */

  if (session.blocks.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-muted text-sm">
          No prescribed workout for this session.
        </p>
        <p className="text-muted text-xs mt-1">
          Use the complete button to mark this session done.
        </p>
      </div>
    );
  }

  // Build the timeline nodes grouped by block
  let prevBlockType = "";
  const timelineNodes: React.ReactNode[] = [];

  for (let blockIdx = 0; blockIdx < session.blocks.length; blockIdx++) {
    const block = session.blocks[blockIdx];

    // Insert block group label when block type changes
    if (block.blockType !== prevBlockType) {
      const label = getBlockLabel(block, blockIdx, session.blocks);
      if (label) {
        const isThrowingLabel = block.blockType === "throwing";
        timelineNodes.push(
          <div
            key={`label-${block.id}`}
            className="relative flex items-center pl-12 py-3"
          >
            <span
              className="text-[10px] font-bold tracking-[0.2em] uppercase"
              style={{
                color: isThrowingLabel ? "#f59e0b" : "#818cf8",
              }}
            >
              {label}
            </span>
            {block.notes && (
              <span className="ml-3 text-[10px] italic" style={{ color: "var(--muted)" }}>
                {block.notes}
              </span>
            )}
          </div>
        );
      }
      prevBlockType = block.blockType;
    }

    // Exercises in this block
    for (const exercise of block.exercises) {
      const fe = flatExercises.find((f) => f.exercise.id === exercise.id);
      if (!fe) continue;

      const state = exerciseLogs.get(exercise.exerciseName);
      const isCompleted = state?.completed ?? false;
      const isExpanded = expandedExerciseId === exercise.id;
      const isThrow = isThrowingExercise(exercise, block);

      // Determine if this exercise can be expanded (it's the active one or completed ones for review)
      // Only the first non-completed exercise is active
      const canExpand = !isCompleted && isExpanded;

      timelineNodes.push(
        <TimelineExerciseNode
          key={exercise.id}
          exercise={exercise}
          block={block}
          isThrow={isThrow}
          isCompleted={isCompleted}
          isExpanded={canExpand}
          state={state ?? null}
          shouldReduceMotion={shouldReduceMotion ?? false}
          isPending={isPending}
          activeCardRef={isExpanded ? activeCardRef : undefined}
          onExpand={() => {
            if (!isCompleted) {
              setExpandedExerciseId(
                expandedExerciseId === exercise.id ? null : exercise.id
              );
            }
          }}
          onLog={(values) => handleLogExercise(exercise, block, values)}
          onAdvance={() => handleAdvanceToNext(exercise.id)}
        />
      );
    }
  }

  return (
    <div className="space-y-2">
      <style>{TIMELINE_STYLES}</style>

      {/* PR Celebration overlay */}
      <PRCelebration
        show={prCelebration.show}
        onDismiss={dismissPrCelebration}
        event={prCelebration.event}
        distance={prCelebration.distance}
      />

      {/* Progress header */}
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
          SESSION PROGRESS
        </span>
        <span className="text-xs tabular-nums font-semibold" style={{ color: "var(--foreground)" }}>
          {loggedCount} / {totalCount}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm font-medium"
          style={{
            backgroundColor: "rgba(239,68,68,0.1)",
            color: "#ef4444",
          }}
        >
          {error}
        </div>
      )}

      {/* Rest timer (floating) */}
      {activeRest !== null && (
        <div
          className="card p-4 flex items-center justify-between"
          style={{ borderLeft: "3px solid #f59e0b" }}
        >
          <span
            className="text-sm font-medium"
            style={{ color: "var(--foreground)" }}
          >
            Rest
          </span>
          <RestTimer
            key={activeRest.key}
            seconds={activeRest.seconds}
            autoStart
            compact
            onComplete={() => setActiveRest(null)}
          />
        </div>
      )}

      {/* Timeline container */}
      <div className="relative" style={{ paddingLeft: "40px" }}>
        {/* Background line */}
        <div
          className="absolute"
          style={{
            left: "19px",
            top: "0",
            bottom: "0",
            width: "2px",
            backgroundColor: "var(--card-border)",
            borderRadius: "1px",
          }}
        />
        {/* Progress fill line */}
        <div
          className="absolute"
          style={{
            left: "19px",
            top: "0",
            width: "2px",
            height: `${progress}%`,
            background: "linear-gradient(180deg, #f59e0b, #d97706)",
            borderRadius: "1px",
            transition: shouldReduceMotion
              ? "none"
              : "height 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />

        {/* Timeline nodes */}
        <div className="space-y-1">{timelineNodes}</div>
      </div>
    </div>
  );
}

/* ─── Timeline Exercise Node ──────────────────────────────────────────────── */

function TimelineExerciseNode({
  exercise,
  block,
  isThrow,
  isCompleted,
  isExpanded,
  state,
  shouldReduceMotion,
  isPending,
  activeCardRef,
  onExpand,
  onLog,
  onAdvance,
}: {
  exercise: PrescribedExercise;
  block: PrescribedBlock;
  isThrow: boolean;
  isCompleted: boolean;
  isExpanded: boolean;
  state: ExerciseLogState | null;
  shouldReduceMotion: boolean;
  isPending: boolean;
  activeCardRef?: React.RefObject<HTMLDivElement>;
  onExpand: () => void;
  onLog: (values: {
    sets: number;
    reps: number | null;
    weight: number | null;
    rpe: number | null;
    distance: number | null;
  }) => void;
  onAdvance: () => void;
}) {
  // Determine if all sets/throws are done for showing completion summary
  const showCompletion = isExpanded && state?.completed;

  return (
    <div className="relative" ref={isExpanded ? activeCardRef : undefined}>
      {/* Timeline dot */}
      <div
        className="absolute"
        style={{
          left: "-28px",
          top: "18px",
          width: "12px",
          height: "12px",
          borderRadius: "50%",
          zIndex: 2,
          ...(isCompleted
            ? {
                backgroundColor: "#4ade80",
                boxShadow: "0 0 8px rgba(74,222,128,0.5)",
              }
            : isExpanded
              ? {
                  backgroundColor: "#f59e0b",
                  animation: shouldReduceMotion
                    ? "none"
                    : "tl-dotPulse 1.8s ease-in-out infinite",
                }
              : {
                  backgroundColor: "var(--card-border)",
                }),
        }}
      />

      {/* Collapsed completed state */}
      {isCompleted && !isExpanded && (
        <div
          className="rounded-xl px-4 py-3 relative overflow-hidden"
          style={{
            opacity: 0.45,
            background: shouldReduceMotion
              ? "var(--card-bg)"
              : `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)`,
            backgroundColor: "var(--card-bg)",
            backgroundSize: "200% 100%",
            animation: shouldReduceMotion
              ? "none"
              : "tl-shimmerSweep 8s ease-in-out infinite",
          }}
        >
          <div className="flex items-center gap-3">
            {/* Green checkmark */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4ade80"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium"
                style={{ color: "var(--foreground)" }}
              >
                {exercise.exerciseName}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                {isThrow && state
                  ? `${state.throws.length} throws${state.bestDistance != null ? ` \u00B7 ${state.bestDistance.toFixed(2)}m best` : ""}`
                  : state && state.strengthSets.length > 0
                    ? `${state.strengthSets.length}\u00D7${state.strengthSets[0].reps ?? "?"}${state.strengthSets[0].weight != null ? ` @ ${state.strengthSets[0].weight}kg` : ""}`
                    : "Completed"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed pending state */}
      {!isCompleted && !isExpanded && (
        <button
          type="button"
          onClick={onExpand}
          className="w-full text-left rounded-xl px-4 py-3"
          style={{ opacity: 0.4 }}
        >
          <p
            className="text-sm font-medium"
            style={{ color: "var(--foreground)" }}
          >
            {exercise.exerciseName}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            {isThrow
              ? `${getTargetThrows(exercise)} throws`
              : exercise.sets != null
                ? `${exercise.sets}\u00D7${exercise.reps ?? "?"} ${exercise.weight ? `@ ${exercise.weight}` : ""}`.trim()
                : ""}
            {exercise.implementKg != null && exercise.implementKg > 0
              ? ` \u00B7 ${exercise.implementKg}kg`
              : ""}
          </p>
        </button>
      )}

      {/* Expanded active state */}
      <AnimatePresence mode="wait">
        {isExpanded && (
          <motion.div
            key={`expanded-${exercise.id}`}
            initial={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 0, height: 0 }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, height: "auto" }
            }
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, height: 0 }
            }
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div
              className="rounded-xl p-5 relative overflow-hidden"
              style={{
                background:
                  "linear-gradient(165deg, rgba(245,158,11,0.04), transparent)",
                backgroundColor: "var(--card-bg)",
                boxShadow:
                  "0 4px 24px rgba(245,158,11,0.08), 0 1px 3px rgba(0,0,0,0.1)",
                // Tilt shine sweep
                backgroundImage: shouldReduceMotion
                  ? undefined
                  : "linear-gradient(115deg, transparent 30%, rgba(245,158,11,0.06) 45%, rgba(245,158,11,0.1) 50%, rgba(245,158,11,0.06) 55%, transparent 70%)",
                backgroundSize: "300% 100%",
                animation: shouldReduceMotion
                  ? "none"
                  : "tl-tiltShine 6s ease-in-out infinite",
              }}
            >
              {/* Header */}
              <div className="mb-4">
                <h3
                  className="text-xl font-bold font-heading"
                  style={{ color: "var(--foreground)" }}
                >
                  {exercise.exerciseName}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  {exercise.implementKg != null &&
                    exercise.implementKg > 0 && (
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: "rgba(245,158,11,0.15)",
                          color: "#f59e0b",
                        }}
                      >
                        {exercise.implementKg}kg
                      </span>
                    )}
                  {exercise.exerciseCategory && (
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--muted)" }}
                    >
                      {exercise.exerciseCategory}
                    </span>
                  )}
                  {block.blockType === "throwing" && (
                    <span
                      className="text-xs"
                      style={{ color: "var(--muted)" }}
                    >
                      {block.name}
                    </span>
                  )}
                </div>
                {exercise.notes && (
                  <p
                    className="text-xs italic mt-2"
                    style={{ color: "var(--muted)" }}
                  >
                    {exercise.notes}
                  </p>
                )}
              </div>

              {/* Content: throw or strength */}
              {showCompletion ? (
                <CompletionSummary
                  exercise={exercise}
                  isThrow={isThrow}
                  state={state!}
                  shouldReduceMotion={shouldReduceMotion}
                  onAdvance={onAdvance}
                />
              ) : isThrow ? (
                <ThrowingInput
                  exercise={exercise}
                  state={state}
                  isPending={isPending}
                  shouldReduceMotion={shouldReduceMotion}
                  onLog={onLog}
                />
              ) : (
                <StrengthInput
                  exercise={exercise}
                  state={state}
                  isPending={isPending}
                  onLog={onLog}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Throwing Input ──────────────────────────────────────────────────────── */

function ThrowingInput({
  exercise,
  state,
  isPending,
  shouldReduceMotion,
  onLog,
}: {
  exercise: PrescribedExercise;
  state: ExerciseLogState | null;
  isPending: boolean;
  shouldReduceMotion: boolean;
  onLog: (values: {
    sets: number;
    reps: number | null;
    weight: number | null;
    rpe: number | null;
    distance: number | null;
  }) => void;
}) {
  const [distanceInput, setDistanceInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const target = getTargetThrows(exercise);
  const throwsDone = state?.throws.length ?? 0;
  const currentThrowNumber = throwsDone + 1;

  // Auto-focus the distance input
  useEffect(() => {
    const timeout = setTimeout(() => {
      inputRef.current?.focus();
    }, 350);
    return () => clearTimeout(timeout);
  }, [throwsDone]);

  function handleLogThrow() {
    const dist = parseFloat(distanceInput);
    if (!dist || dist <= 0) return;
    onLog({
      sets: 1,
      reps: 1,
      weight: null,
      rpe: null,
      distance: dist,
    });
    setDistanceInput("");
  }

  // Progress dots
  const progressDots = Array.from({ length: target }, (_, i) => {
    const done = i < throwsDone;
    return (
      <div
        key={i}
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: done ? "#4ade80" : "var(--card-border)",
          transition: "background-color 0.3s",
        }}
      />
    );
  });

  // Sorted throws (newest first)
  const sortedThrows = state
    ? [...state.throws].sort((a, b) => b.throwNumber - a.throwNumber)
    : [];

  return (
    <div>
      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {progressDots}
        <span
          className="text-xs ml-2 tabular-nums"
          style={{ color: "var(--muted)" }}
        >
          {throwsDone}/{target} throws
        </span>
      </div>

      {/* Distance input */}
      {throwsDone < target && (
        <div className="space-y-3">
          <div>
            <label
              className="text-xs font-medium block mb-1.5"
              style={{ color: "var(--muted)" }}
            >
              Distance (m)
            </label>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={distanceInput}
              onChange={(e) => setDistanceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogThrow();
              }}
              className="input w-full tabular-nums"
              style={{
                height: "56px",
                fontSize: "24px",
                fontWeight: 600,
                textAlign: "center",
                letterSpacing: "0.02em",
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleLogThrow}
            disabled={isPending || !distanceInput}
            className="w-full font-semibold text-white rounded-xl relative overflow-hidden"
            style={{
              minHeight: "52px",
              fontSize: "16px",
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              opacity: isPending || !distanceInput ? 0.5 : 1,
              cursor:
                isPending || !distanceInput ? "not-allowed" : "pointer",
              transition: shouldReduceMotion
                ? "opacity 0.15s"
                : "transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s",
            }}
            onPointerDown={(e) => {
              if (!shouldReduceMotion) {
                (e.currentTarget as HTMLElement).style.transform =
                  "scale(0.93)";
              }
            }}
            onPointerUp={(e) => {
              if (!shouldReduceMotion) {
                (e.currentTarget as HTMLElement).style.transform = "scale(1)";
              }
            }}
            onPointerLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
          >
            {isPending ? "Logging..." : `Log Throw #${currentThrowNumber}`}
          </button>
        </div>
      )}

      {/* Logged throws list (newest first) */}
      {sortedThrows.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {sortedThrows.map((t, i) => {
            const isBest =
              state?.bestDistance != null &&
              t.distance === state.bestDistance;
            return (
              <div
                key={t.throwNumber}
                className="flex items-center justify-between rounded-lg px-3 py-2"
                style={{
                  backgroundColor: isBest
                    ? "rgba(245,158,11,0.1)"
                    : "rgba(255,255,255,0.03)",
                  animation:
                    shouldReduceMotion || i > 0
                      ? "none"
                      : "tl-throwSlideIn 0.35s ease-out both",
                  animationDelay: shouldReduceMotion
                    ? "0ms"
                    : `${i * 60}ms`,
                }}
              >
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  #{t.throwNumber}
                </span>
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{
                    color: isBest ? "#f59e0b" : "var(--foreground)",
                    textShadow: isBest
                      ? "0 0 12px rgba(245,158,11,0.4)"
                      : "none",
                  }}
                >
                  {t.distance.toFixed(2)}m
                  {isBest && (
                    <span
                      className="text-[10px] ml-1.5 font-bold uppercase"
                      style={{ color: "#f59e0b" }}
                    >
                      BEST
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Strength Input ──────────────────────────────────────────────────────── */

function StrengthInput({
  exercise,
  state,
  isPending,
  onLog,
}: {
  exercise: PrescribedExercise;
  state: ExerciseLogState | null;
  isPending: boolean;
  onLog: (values: {
    sets: number;
    reps: number | null;
    weight: number | null;
    rpe: number | null;
    distance: number | null;
  }) => void;
}) {
  const [weightInput, setWeightInput] = useState(exercise.weight ?? "");
  const [repsInput, setRepsInput] = useState(exercise.reps ?? "");
  const [rpeInput, setRpeInput] = useState(
    exercise.rpe != null ? String(exercise.rpe) : ""
  );
  const targetSets = exercise.sets ?? 1;
  const setsDone = state?.strengthSets.length ?? 0;
  const currentSetNumber = setsDone + 1;

  // Prescription display
  const prescriptionDisplay = [
    exercise.sets != null ? `${exercise.sets} sets` : null,
    exercise.reps ? `${exercise.reps} reps` : null,
    exercise.weight ? `@ ${exercise.weight}` : null,
    exercise.rpe != null ? `RPE ${exercise.rpe}` : null,
  ]
    .filter(Boolean)
    .join(" \u00B7 ");

  function handleLogSet() {
    const w = weightInput ? parseFloat(String(weightInput)) || null : null;
    const r = repsInput ? parseInt(String(repsInput), 10) || null : null;
    const rpe = rpeInput ? parseFloat(rpeInput) || null : null;

    onLog({
      sets: 1,
      reps: r,
      weight: w,
      rpe,
      distance: null,
    });
  }

  return (
    <div>
      {/* Prescription */}
      {prescriptionDisplay && (
        <p
          className="text-xs mb-4 px-3 py-1.5 rounded-lg inline-block"
          style={{
            backgroundColor: "rgba(129,140,248,0.1)",
            color: "#818cf8",
          }}
        >
          {prescriptionDisplay}
        </p>
      )}

      {/* Logged sets */}
      {state && state.strengthSets.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {state.strengthSets.map((s) => (
            <div
              key={s.setNumber}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ backgroundColor: "rgba(74,222,128,0.06)" }}
            >
              <span
                className="text-xs font-medium"
                style={{ color: "var(--muted)" }}
              >
                Set {s.setNumber}
              </span>
              <span
                className="text-sm font-semibold tabular-nums"
                style={{ color: "var(--foreground)" }}
              >
                {s.reps ?? "?"}
                {s.weight != null ? ` @ ${s.weight}kg` : ""}
                {s.rpe != null ? ` RPE ${s.rpe}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Input form for next set */}
      {setsDone < targetSets && (
        <div className="space-y-3">
          <p
            className="text-xs font-medium"
            style={{ color: "var(--muted)" }}
          >
            Set {currentSetNumber} of {targetSets}
          </p>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label
                className="text-[10px] uppercase tracking-wider block mb-1"
                style={{ color: "var(--muted)" }}
              >
                Weight
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="kg"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="input w-full tabular-nums"
                style={{
                  height: "48px",
                  fontSize: "18px",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              />
            </div>
            <div>
              <label
                className="text-[10px] uppercase tracking-wider block mb-1"
                style={{ color: "var(--muted)" }}
              >
                Reps
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder={exercise.reps ?? "#"}
                value={repsInput}
                onChange={(e) => setRepsInput(e.target.value)}
                className="input w-full tabular-nums"
                style={{
                  height: "48px",
                  fontSize: "18px",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              />
            </div>
            <div>
              <label
                className="text-[10px] uppercase tracking-wider block mb-1"
                style={{ color: "var(--muted)" }}
              >
                RPE
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder={exercise.rpe?.toString() ?? "—"}
                value={rpeInput}
                onChange={(e) => setRpeInput(e.target.value)}
                className="input w-full tabular-nums"
                style={{
                  height: "48px",
                  fontSize: "18px",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogSet}
            disabled={isPending}
            className="w-full font-semibold text-white rounded-xl"
            style={{
              minHeight: "52px",
              fontSize: "16px",
              background: "linear-gradient(135deg, #818cf8, #6366f1)",
              opacity: isPending ? 0.5 : 1,
              cursor: isPending ? "not-allowed" : "pointer",
              transition:
                "transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s",
            }}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(0.93)";
            }}
            onPointerUp={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
            onPointerLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
          >
            {isPending
              ? "Logging..."
              : `Log Set ${currentSetNumber}`}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Completion Summary ──────────────────────────────────────────────────── */

function CompletionSummary({
  exercise: _exercise,
  isThrow,
  state,
  shouldReduceMotion,
  onAdvance,
}: {
  exercise: PrescribedExercise;
  isThrow: boolean;
  state: ExerciseLogState;
  shouldReduceMotion: boolean;
  onAdvance: () => void;
}) {
  // CSS confetti particles
  const confettiParticles = Array.from({ length: 12 }, (_, i) => {
    const colors = ["#f59e0b", "#4ade80", "#818cf8", "#f43f5e", "#22d3ee"];
    const color = colors[i % colors.length];
    const size = 4 + (i % 3) * 2;
    const left = 10 + (i * 7.5);
    const delay = i * 0.15;
    return (
      <span
        key={i}
        style={{
          position: "absolute",
          left: `${left}%`,
          top: "10px",
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: i % 2 === 0 ? "50%" : "1px",
          backgroundColor: color,
          animation: shouldReduceMotion
            ? "none"
            : `tl-confettiDrift 1.5s ${delay}s ease-out both`,
          pointerEvents: "none",
        }}
      />
    );
  });

  return (
    <div
      className="rounded-xl p-4 relative overflow-hidden"
      style={{
        backgroundColor: "rgba(74,222,128,0.06)",
        border: "1px solid rgba(74,222,128,0.15)",
      }}
    >
      {/* Confetti particles */}
      {confettiParticles}

      <div className="flex items-center gap-2 mb-3">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#4ade80"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span
          className="text-sm font-bold"
          style={{ color: "#4ade80" }}
        >
          Exercise Complete
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {isThrow ? (
          <>
            <StatPill
              label="Throws"
              value={`${state.throws.length}`}
            />
            {state.bestDistance != null && (
              <StatPill
                label="Best"
                value={`${state.bestDistance.toFixed(2)}m`}
                highlight
              />
            )}
          </>
        ) : (
          <>
            <StatPill
              label="Sets"
              value={`${state.strengthSets.length}`}
            />
            {state.strengthSets.length > 0 && state.strengthSets[0].weight != null && (
              <StatPill
                label="Weight"
                value={`${state.strengthSets[0].weight}kg`}
              />
            )}
            {state.strengthSets.some((s) => s.rpe != null) && (
              <StatPill
                label="Avg RPE"
                value={(() => {
                  const rpes = state.strengthSets
                    .map((s) => s.rpe)
                    .filter((r): r is number => r != null);
                  if (rpes.length === 0) return "—";
                  const avg = rpes.reduce((a, b) => a + b, 0) / rpes.length;
                  return avg.toFixed(1);
                })()}
              />
            )}
          </>
        )}
      </div>

      {/* Next button */}
      <button
        type="button"
        onClick={onAdvance}
        className="w-full font-semibold rounded-xl flex items-center justify-center gap-2"
        style={{
          minHeight: "48px",
          fontSize: "15px",
          backgroundColor: "rgba(74,222,128,0.15)",
          color: "#4ade80",
          cursor: "pointer",
          transition:
            "transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.15s",
        }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "scale(0.95)";
        }}
        onPointerUp={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1)";
        }}
        onPointerLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1)";
        }}
      >
        Next
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}

/* ─── Stat Pill ───────────────────────────────────────────────────────────── */

function StatPill({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2 text-center"
      style={{
        backgroundColor: highlight
          ? "rgba(245,158,11,0.1)"
          : "rgba(255,255,255,0.04)",
      }}
    >
      <p
        className="text-[10px] uppercase tracking-wider mb-0.5"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </p>
      <p
        className="text-sm font-bold tabular-nums"
        style={{
          color: highlight ? "#f59e0b" : "var(--foreground)",
          textShadow: highlight
            ? "0 0 12px rgba(245,158,11,0.4)"
            : "none",
        }}
      >
        {value}
      </p>
    </div>
  );
}
