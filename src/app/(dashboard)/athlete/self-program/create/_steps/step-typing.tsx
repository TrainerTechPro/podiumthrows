"use client";

import { Zap, Gauge, Clock } from "lucide-react";
import type { WizardFormState } from "../_wizard";

interface StepTypingProps {
  form: WizardFormState;
  update: (field: string, value: unknown) => void;
  errors: Record<string, string>;
}

const ADAPTATION_SPEEDS = [
  {
    value: 1,
    label: "Fast Adapter",
    description: "You improve quickly but plateau just as fast. Need frequent exercise changes.",
    icon: Zap,
  },
  {
    value: 2,
    label: "Moderate Adapter",
    description: "Steady, predictable gains over several weeks. Most common profile.",
    icon: Gauge,
  },
  {
    value: 3,
    label: "Slow Adapter",
    description: "Takes longer to see results, but improvements are more durable and stable.",
    icon: Clock,
  },
];

const TRANSFER_TYPES = [
  {
    value: "HEAVY_DOMINANT",
    label: "Heavy-Dominant",
    description: "You throw best after heavy implement work. Overweight training transfers well.",
  },
  {
    value: "BALANCED",
    label: "Balanced",
    description: "Both heavy and light implements contribute equally to competition performance.",
  },
  {
    value: "COMPETITION_DOMINANT",
    label: "Competition-Dominant",
    description: "You perform best when most training is done at competition weight.",
  },
];

const RECOVERY_PROFILES = [
  {
    value: "FAST",
    label: "Fast Recovery",
    description: "Ready to train hard again within 24 hours. Can handle high frequency.",
  },
  {
    value: "MODERATE",
    label: "Moderate Recovery",
    description: "Need 36-48 hours between intense sessions. Standard training frequency.",
  },
  {
    value: "SLOW",
    label: "Slow Recovery",
    description: "Need 48-72 hours between hard sessions. Better with lower frequency, higher quality.",
  },
];

export function StepTyping({ form, update, errors: _errors }: StepTypingProps) {
  function skipAndUseDefaults() {
    update("adaptationSpeed", 2);
    update("transferType", "BALANCED");
    update("recoveryProfile", "MODERATE");
  }

  return (
    <div className="space-y-6 p-1">
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-1">
          Athlete Typing
        </h2>
        <p className="text-body text-surface-700 dark:text-surface-300">
          Help us understand how your body responds to training. This personalizes your
          program based on Bondarchuk&apos;s athlete classification system.
        </p>
      </div>

      {/* Adaptation Speed */}
      <div>
        <p className="text-sm font-medium text-[var(--foreground)] mb-2">
          How quickly do you adapt to new exercises?
        </p>
        <div className="space-y-2">
          {ADAPTATION_SPEEDS.map((option) => {
            const Icon = option.icon;
            const isSelected = form.adaptationSpeed === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => update("adaptationSpeed", option.value)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/20"
                    : "border-[var(--card-border)] hover:border-[var(--color-border-strong)]"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected
                      ? "bg-primary-500 text-black"
                      : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-[var(--foreground)]">{option.label}</p>
                  <p className="text-xs text-surface-700 dark:text-surface-300 mt-0.5">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Transfer Type */}
      <div>
        <p className="text-sm font-medium text-[var(--foreground)] mb-2">
          What implement weights transfer best to competition?
        </p>
        <div className="space-y-2">
          {TRANSFER_TYPES.map((option) => {
            const isSelected = form.transferType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => update("transferType", option.value)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/20"
                    : "border-[var(--card-border)] hover:border-[var(--color-border-strong)]"
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 border-2 transition-colors ${
                    isSelected
                      ? "border-primary-500 bg-primary-500"
                      : "border-surface-300 dark:border-surface-600"
                  }`}
                />
                <div className="min-w-0">
                  <p className="font-medium text-sm text-[var(--foreground)]">{option.label}</p>
                  <p className="text-xs text-surface-700 dark:text-surface-300 mt-0.5">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recovery Profile */}
      <div>
        <p className="text-sm font-medium text-[var(--foreground)] mb-2">
          How quickly do you recover between sessions?
        </p>
        <div className="space-y-2">
          {RECOVERY_PROFILES.map((option) => {
            const isSelected = form.recoveryProfile === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => update("recoveryProfile", option.value)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/20"
                    : "border-[var(--card-border)] hover:border-[var(--color-border-strong)]"
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 border-2 transition-colors ${
                    isSelected
                      ? "border-primary-500 bg-primary-500"
                      : "border-surface-300 dark:border-surface-600"
                  }`}
                />
                <div className="min-w-0">
                  <p className="font-medium text-sm text-[var(--foreground)]">{option.label}</p>
                  <p className="text-xs text-surface-700 dark:text-surface-300 mt-0.5">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Skip button */}
      <div className="pt-2 border-t border-[var(--card-border)]">
        <button
          type="button"
          onClick={skipAndUseDefaults}
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
        >
          Skip and use defaults
        </button>
        <p className="text-caption text-surface-700 dark:text-surface-300 mt-1">
          We&apos;ll use &ldquo;Moderate&rdquo; for all settings. You can always adjust later.
        </p>
      </div>
    </div>
  );
}
