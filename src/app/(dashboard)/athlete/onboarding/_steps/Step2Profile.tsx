"use client";

import { cn } from "@/lib/utils";
import type { ClassStanding, TrainingLevel, TurnDirection } from "../_state";

interface Step2ProfileProps {
  classStanding: ClassStanding | null;
  trainingLevel: TrainingLevel | null;
  turnDirection: TurnDirection | null;
  onClassStanding: (v: ClassStanding | null) => void;
  onTrainingLevel: (v: TrainingLevel | null) => void;
  onTurnDirection: (v: TurnDirection | null) => void;
}

const CLASS_OPTIONS: Array<{ value: ClassStanding; label: string }> = [
  { value: "FR", label: "HS" }, // FR is a stand-in for High School in v1
  { value: "JR", label: "College" },
  { value: "PRO", label: "Pro" },
  { value: "GRAD", label: "Masters" },
];

const LEVEL_OPTIONS: Array<{ value: TrainingLevel; label: string }> = [
  { value: "STARTING", label: "Just starting" },
  { value: "FEW_SEASONS", label: "A few seasons in" },
  { value: "COMPETING", label: "Competing seriously" },
  { value: "ELITE", label: "Elite" },
];

const SIDE_OPTIONS: Array<{ value: TurnDirection; label: string }> = [
  { value: "RIGHT", label: "Right" },
  { value: "LEFT", label: "Left" },
];

export function Step2Profile({
  classStanding,
  trainingLevel,
  turnDirection,
  onClassStanding,
  onTrainingLevel,
  onTurnDirection,
}: Step2ProfileProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[var(--foreground)] leading-tight">
          A few stats.
        </h1>
        <p className="text-sm text-muted">All optional. Coaches don&apos;t see what you skip.</p>
      </div>

      <fieldset className="space-y-2.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider">
          Class year
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {CLASS_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onClassStanding(classStanding === value ? null : value)}
              aria-pressed={classStanding === value}
              className={cn(
                "h-11 rounded-xl text-sm font-medium transition-colors duration-150 active:scale-[0.97]",
                "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
                classStanding === value
                  ? "bg-primary-500/12 border-primary-500/50 text-[var(--foreground)]"
                  : "bg-[var(--card-bg)] border-[var(--card-border)] text-muted hover:border-primary-500/30 hover:text-[var(--foreground)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider">
          Training level
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {LEVEL_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onTrainingLevel(trainingLevel === value ? null : value)}
              aria-pressed={trainingLevel === value}
              className={cn(
                "h-12 rounded-xl text-sm font-medium transition-colors duration-150 active:scale-[0.97]",
                "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
                trainingLevel === value
                  ? "bg-primary-500/12 border-primary-500/50 text-[var(--foreground)]"
                  : "bg-[var(--card-bg)] border-[var(--card-border)] text-muted hover:border-primary-500/30 hover:text-[var(--foreground)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider">
          Throwing side
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {SIDE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onTurnDirection(turnDirection === value ? null : value)}
              aria-pressed={turnDirection === value}
              className={cn(
                "h-14 rounded-xl text-base font-heading font-semibold transition-colors duration-150 active:scale-[0.97]",
                "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
                turnDirection === value
                  ? "bg-primary-500/12 border-primary-500/50 text-[var(--foreground)]"
                  : "bg-[var(--card-bg)] border-[var(--card-border)] text-muted hover:border-primary-500/30 hover:text-[var(--foreground)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
