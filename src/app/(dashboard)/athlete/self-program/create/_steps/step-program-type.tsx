"use client";

import { Dumbbell, Target } from "lucide-react";
import type { WizardFormState } from "../_wizard";

interface StepProgramTypeProps {
  form: WizardFormState;
  update: (field: string, value: unknown) => void;
  errors: Record<string, string>;
}

const PROGRAM_TYPES = [
  {
    value: "THROWS_ONLY" as const,
    label: "Throws Only",
    description: "Throwing sessions with implement sequencing based on Bondarchuk methodology",
    icon: Target,
  },
  {
    value: "THROWS_AND_LIFTING" as const,
    label: "Throws + Lifting",
    description:
      "Complete program with throwing blocks and strength training integrated per Bondarchuk session structure",
    icon: Dumbbell,
  },
];

export function StepProgramType({ form, update, errors }: StepProgramTypeProps) {
  return (
    <div className="space-y-4 p-1">
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-1">
          Program Type
        </h2>
        <p className="text-body text-surface-700 dark:text-surface-300">
          What kind of training program do you need?
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PROGRAM_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = form.programType === type.value;
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => update("programType", type.value)}
              className={`card card-interactive p-5 text-left transition-colors ${
                isSelected
                  ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/20"
                  : "border-[var(--card-border)]"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isSelected
                      ? "bg-primary-500 text-black"
                      : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300"
                  }`}
                >
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-[var(--foreground)]">{type.label}</p>
                  <p className="text-xs text-surface-700 dark:text-surface-300 mt-1 leading-relaxed">
                    {type.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {errors.programType && (
        <p className="text-sm text-danger-600 dark:text-danger-400">{errors.programType}</p>
      )}
    </div>
  );
}
