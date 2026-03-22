"use client";

import { Crosshair, Focus, BarChart3, Sparkles, Settings2 } from "lucide-react";
import type { WizardFormState } from "../_wizard";

interface StepGoalsProps {
  form: WizardFormState;
  update: (field: string, value: unknown) => void;
  errors: Record<string, string>;
}

const PRIMARY_GOALS = [
  {
    value: "DISTANCE",
    label: "Distance",
    description: "Maximize throwing distance. The program will prioritize progressive overload and implement sequencing for transfer.",
    icon: Crosshair,
  },
  {
    value: "TECHNIQUE",
    label: "Technique",
    description: "Refine technical consistency. Higher volume at lower intensity with more standing and positional drills.",
    icon: Focus,
  },
  {
    value: "CONSISTENCY",
    label: "Consistency",
    description: "Reduce session-to-session variance. Focus on competition simulation and repeatability.",
    icon: BarChart3,
  },
] as const;

const GENERATION_MODES = [
  {
    value: "AUTOPILOT",
    label: "Autopilot",
    description:
      "Let the engine build everything. Best for athletes who trust the Bondarchuk methodology and want a turnkey solution.",
    icon: Sparkles,
  },
  {
    value: "GUIDED",
    label: "Guided with Preferences",
    description:
      "You select preferred exercises, drills to avoid, and favorite warm-up routines. The engine uses your preferences as constraints.",
    icon: Settings2,
  },
] as const;

export function StepGoals({ form, update, errors }: StepGoalsProps) {
  return (
    <div className="space-y-6 p-1">
      {/* Primary Goal */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-1">
          Primary Goal
        </h2>
        <p className="text-body text-surface-700 dark:text-surface-300 mb-3">
          What should this program optimize for?
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {PRIMARY_GOALS.map((goal) => {
            const Icon = goal.icon;
            const isSelected = form.primaryGoal === goal.value;
            return (
              <button
                key={goal.value}
                type="button"
                onClick={() => update("primaryGoal", goal.value)}
                className={`card card-interactive p-4 text-left transition-all ${
                  isSelected
                    ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/20"
                    : "border-[var(--card-border)]"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                    isSelected
                      ? "bg-primary-500 text-black"
                      : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300"
                  }`}
                >
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                </div>
                <p className="font-semibold text-sm text-[var(--foreground)] mb-1">{goal.label}</p>
                <p className="text-xs text-surface-700 dark:text-surface-300 leading-relaxed">
                  {goal.description}
                </p>
              </button>
            );
          })}
        </div>

        {errors.primaryGoal && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.primaryGoal}</p>
        )}
      </div>

      {/* Generation Mode */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-1">
          Generation Mode
        </h2>
        <p className="text-body text-surface-700 dark:text-surface-300 mb-3">
          How much control do you want over exercise selection?
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {GENERATION_MODES.map((mode) => {
            const Icon = mode.icon;
            const isSelected = form.generationMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => update("generationMode", mode.value)}
                className={`card card-interactive p-4 text-left transition-all ${
                  isSelected
                    ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/20"
                    : "border-[var(--card-border)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? "bg-primary-500 text-black"
                        : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300"
                    }`}
                  >
                    <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[var(--foreground)]">{mode.label}</p>
                    <p className="text-xs text-surface-700 dark:text-surface-300 mt-1 leading-relaxed">
                      {mode.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {errors.generationMode && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.generationMode}</p>
        )}
      </div>
    </div>
  );
}
