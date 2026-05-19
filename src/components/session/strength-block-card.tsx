"use client";

import { useState, useRef, type Dispatch } from "react";
import type { StrengthBlock, LiftEntry, SessionAction } from "./use-session-reducer";
import { CLASSIFICATION_COLORS } from "@/lib/throws/constants";

// ── Props ────────────────────────────────────────────────────────────

interface StrengthBlockCardProps {
  blocks: StrengthBlock[];
  liftsByBlock: Record<number, LiftEntry[]>;
  dispatch: Dispatch<SessionAction>;
  onLogLift: (blockIndex: number, entry: LiftEntry) => void;
  onDone: () => void;
}

// ── Component ────────────────────────────────────────────────────────

export function StrengthBlockCard({
  blocks,
  liftsByBlock,
  dispatch: _dispatch,
  onLogLift,
  onDone,
}: StrengthBlockCardProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      {blocks.map((block, blockIdx) => (
        <SingleStrengthBlock
          key={blockIdx}
          block={block}
          blockIndex={blockIdx}
          logged={liftsByBlock[blockIdx] ?? []}
          onLogLift={onLogLift}
        />
      ))}

      <button
        type="button"
        onClick={onDone}
        className="btn-primary w-full py-3 text-sm font-semibold"
      >
        Done with Strength
      </button>
    </div>
  );
}

// ── Single Exercise Block ────────────────────────────────────────────

interface SingleStrengthBlockProps {
  block: StrengthBlock;
  blockIndex: number;
  logged: LiftEntry[];
  onLogLift: (blockIndex: number, entry: LiftEntry) => void;
}

function SingleStrengthBlock({ block, blockIndex, logged, onLogLift }: SingleStrengthBlockProps) {
  const [weight, setWeight] = useState(block.loadKg?.toString() ?? "");
  const [reps, setReps] = useState(block.reps.toString());
  const [rpe, setRpe] = useState("");
  const weightRef = useRef<HTMLInputElement>(null);

  const setsLogged = logged.length;
  const allDone = setsLogged >= block.sets;
  const categoryColor =
    CLASSIFICATION_COLORS[block.classification] ??
    "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400";

  function handleLog() {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (isNaN(r) || r <= 0) return;

    const entry: LiftEntry = {
      exerciseName: block.exerciseName,
      exerciseId: block.exerciseId,
      weight: isNaN(w) ? 0 : w,
      reps: r,
      rpe: rpe ? parseFloat(rpe) : undefined,
      setNumber: setsLogged + 1,
      synced: false,
    };

    onLogLift(blockIndex, entry);
    setRpe("");
    setTimeout(() => weightRef.current?.focus(), 50);
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded-md font-semibold ${categoryColor}`}>
          {block.classification}
        </span>
        <span className="text-sm font-semibold text-surface-900 dark:text-white">
          {block.exerciseName}
        </span>
      </div>

      {/* Prescription info */}
      <p className="text-xs text-surface-500 dark:text-surface-400 mb-3">
        {block.sets} sets &times; {block.reps} reps
        {block.loadKg ? ` @ ${block.loadKg}kg` : ""}
        {block.intensityPercent ? ` (${block.intensityPercent}%)` : ""}
        &middot; {block.restSeconds}s rest
      </p>

      {/* Logged sets */}
      {logged.length > 0 && (
        <div className="space-y-1 mb-3">
          {logged.map((lift, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-surface-50 dark:bg-surface-800/50"
            >
              <span className="text-surface-500 dark:text-surface-400">Set {lift.setNumber}</span>
              <span className="font-semibold text-surface-900 dark:text-white tabular-nums">
                {lift.weight}kg &times; {lift.reps}
                {lift.rpe ? ` @ RPE ${lift.rpe}` : ""}
              </span>
              {!lift.synced && <span className="text-xs text-surface-400" aria-label="Pending sync">…</span>}
            </div>
          ))}
        </div>
      )}

      {/* Set progress */}
      <div className="flex items-center gap-1.5 mb-3">
        {Array.from({ length: block.sets }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < setsLogged
                ? "bg-primary-500"
                : i === setsLogged && !allDone
                  ? "bg-primary-300 dark:bg-primary-700"
                  : "bg-surface-200 dark:bg-surface-700"
            }`}
          />
        ))}
        <span className="text-xs text-surface-500 ml-1 tabular-nums">
          {setsLogged}/{block.sets}
        </span>
      </div>

      {/* Input row (hidden when all sets done) */}
      {!allDone && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-nano uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-0.5 block">
                kg
              </label>
              <input
                ref={weightRef}
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.]?[0-9]*"
                className="input w-full text-center tabular-nums"
                placeholder="Weight"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="flex-1">
              <label className="text-nano uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-0.5 block">
                Reps
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="input w-full text-center tabular-nums"
                placeholder="Reps"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="w-16">
              <label className="text-nano uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-0.5 block">
                RPE
              </label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.]?[0-9]*"
                className="input w-full text-center tabular-nums"
                placeholder="—"
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleLog}
            disabled={!reps}
            className="btn-primary w-full py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            Log Set {setsLogged + 1}
          </button>
        </div>
      )}

      {allDone && (
        <p className="text-center text-xs font-medium text-success-600 dark:text-success-400">
          All sets complete
        </p>
      )}
    </div>
  );
}
