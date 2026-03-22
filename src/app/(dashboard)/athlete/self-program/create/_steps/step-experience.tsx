"use client";

import type { WizardFormState } from "../_wizard";

interface StepExperienceProps {
  form: WizardFormState;
  update: (field: string, value: unknown) => void;
  errors: Record<string, string>;
}

const COMPETITION_LEVELS = [
  { value: "HIGH_SCHOOL", label: "High School" },
  { value: "COLLEGIATE", label: "Collegiate" },
  { value: "POST_COLLEGIATE", label: "Post-Collegiate" },
  { value: "ELITE", label: "Elite / Professional" },
];

export function StepExperience({ form, update, errors }: StepExperienceProps) {
  return (
    <div className="space-y-5 p-1">
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-1">
          Experience & Performance
        </h2>
        <p className="text-body text-surface-700 dark:text-surface-300">
          Tell us about your throwing background so we can calibrate your program
        </p>
      </div>

      {/* Years Throwing */}
      <div>
        <label className="label" htmlFor="yearsExperience">
          Years Throwing
        </label>
        <input
          id="yearsExperience"
          type="number"
          min="0"
          max="40"
          step="1"
          className="input w-full"
          placeholder="e.g. 4"
          value={form.yearsExperience}
          onChange={(e) => update("yearsExperience", e.target.value)}
        />
        {errors.yearsExperience && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            {errors.yearsExperience}
          </p>
        )}
      </div>

      {/* Competition Level */}
      <div>
        <label className="label" htmlFor="competitionLevel">
          Competition Level
        </label>
        <select
          id="competitionLevel"
          className="input w-full"
          value={form.competitionLevel}
          onChange={(e) => update("competitionLevel", e.target.value)}
        >
          <option value="">Select level...</option>
          {COMPETITION_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>
        {errors.competitionLevel && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            {errors.competitionLevel}
          </p>
        )}
      </div>

      {/* Current PR */}
      <div>
        <label className="label" htmlFor="currentPR">
          Current PR
        </label>
        <div className="relative">
          <input
            id="currentPR"
            type="number"
            min="0"
            step="0.01"
            className="input w-full pr-8"
            placeholder="e.g. 15.50"
            value={form.currentPR}
            onChange={(e) => update("currentPR", e.target.value)}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">
            m
          </span>
        </div>
        {errors.currentPR && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.currentPR}</p>
        )}
      </div>

      {/* Goal Distance */}
      <div>
        <label className="label" htmlFor="goalDistance">
          Goal Distance
        </label>
        <div className="relative">
          <input
            id="goalDistance"
            type="number"
            min="0"
            step="0.01"
            className="input w-full pr-8"
            placeholder="e.g. 17.00"
            value={form.goalDistance}
            onChange={(e) => update("goalDistance", e.target.value)}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">
            m
          </span>
        </div>
        {errors.goalDistance && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.goalDistance}</p>
        )}
      </div>

      {/* Current Weekly Volume (optional) */}
      <div>
        <label className="label" htmlFor="currentWeeklyVolume">
          Current Weekly Volume{" "}
          <span className="text-xs font-normal text-muted">(optional)</span>
        </label>
        <div className="relative">
          <input
            id="currentWeeklyVolume"
            type="number"
            min="0"
            step="1"
            className="input w-full pr-16"
            placeholder="e.g. 150"
            value={form.currentWeeklyVolume}
            onChange={(e) => update("currentWeeklyVolume", e.target.value)}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">
            throws/wk
          </span>
        </div>
        <p className="text-caption text-surface-700 dark:text-surface-300 mt-1">
          Approximate number of throws you currently take per week
        </p>
      </div>
    </div>
  );
}
