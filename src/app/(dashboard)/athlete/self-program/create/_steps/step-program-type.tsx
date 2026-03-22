"use client";

import { Dumbbell, Target, Lock } from "lucide-react";
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
              className={`card card-interactive p-5 text-left transition-all ${
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

        {/* Lifting Only — Coming Soon */}
        <div className="relative card p-5 text-left opacity-50 cursor-not-allowed border-[var(--card-border)]">
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="px-3 py-1 bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-full text-xs font-semibold flex items-center gap-1.5">
              <Lock size={12} strokeWidth={1.75} aria-hidden="true" />
              Coming Soon
            </span>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300">
              <Dumbbell size={20} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-[var(--foreground)]">Lifting Only</p>
              <p className="text-xs text-surface-700 dark:text-surface-300 mt-1 leading-relaxed">
                Strength program without throwing sessions
              </p>
            </div>
          </div>
        </div>
      </div>

      {errors.programType && (
        <p className="text-sm text-red-600 dark:text-red-400">{errors.programType}</p>
      )}
    </div>
  );
}
