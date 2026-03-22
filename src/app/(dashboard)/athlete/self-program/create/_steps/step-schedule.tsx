"use client";

import { NumberFlow } from "@/components/ui/NumberFlow";
import type { WizardFormState } from "../_wizard";

interface StepScheduleProps {
  form: WizardFormState;
  update: (field: string, value: unknown) => void;
  errors: Record<string, string>;
}

const DAYS = [
  { value: "MONDAY", label: "Mon" },
  { value: "TUESDAY", label: "Tue" },
  { value: "WEDNESDAY", label: "Wed" },
  { value: "THURSDAY", label: "Thu" },
  { value: "FRIDAY", label: "Fri" },
  { value: "SATURDAY", label: "Sat" },
  { value: "SUNDAY", label: "Sun" },
] as const;

const DAYS_PER_WEEK_OPTIONS = [2, 3, 4, 5] as const;

export function StepSchedule({ form, update, errors }: StepScheduleProps) {
  function toggleDay(day: string) {
    const current = form.preferredDays;
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    update("preferredDays", next);
  }

  return (
    <div className="space-y-6 p-1">
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-1">
          Training Schedule
        </h2>
        <p className="text-body text-surface-700 dark:text-surface-300">
          Set your weekly training availability
        </p>
      </div>

      {/* Days per Week */}
      <div>
        <p className="text-sm font-medium text-[var(--foreground)] mb-2">
          Days per week:{" "}
          <NumberFlow value={form.daysPerWeek} className="font-semibold text-primary-600 dark:text-primary-400" />
        </p>
        <div className="flex gap-2">
          {DAYS_PER_WEEK_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => update("daysPerWeek", n)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                form.daysPerWeek === n
                  ? "bg-primary-500 text-white shadow-md"
                  : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Sessions per Day */}
      <div>
        <p className="text-sm font-medium text-[var(--foreground)] mb-2">
          Sessions per day
        </p>
        <div className="flex rounded-xl border border-[var(--card-border)] overflow-hidden">
          {[1, 2].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => update("sessionsPerDay", n)}
              className={`flex-1 py-2.5 text-sm font-medium transition-all ${
                form.sessionsPerDay === n
                  ? "bg-primary-500 text-white"
                  : "bg-transparent text-surface-700 dark:text-surface-300 hover:bg-[var(--muted-bg)]"
              }`}
            >
              {n === 1 ? "Single Session" : "Double Sessions"}
            </button>
          ))}
        </div>
        {form.sessionsPerDay === 2 && (
          <p className="text-caption text-amber-700 dark:text-amber-400 mt-1">
            Double sessions split throws and strength into separate AM/PM sessions
          </p>
        )}
      </div>

      {/* Preferred Days */}
      <div>
        <p className="text-sm font-medium text-[var(--foreground)] mb-2">
          Preferred training days
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((day) => {
            const isSelected = form.preferredDays.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                className={`py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-primary-500 text-white shadow-sm"
                    : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700"
                }`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
        {errors.preferredDays && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.preferredDays}</p>
        )}
        <p className="text-caption text-surface-700 dark:text-surface-300 mt-1">
          Select the days you&apos;re available to train. Pick at least{" "}
          <NumberFlow
            value={form.daysPerWeek}
            className="font-semibold"
          />{" "}
          days.
        </p>
      </div>

      {/* Start Date */}
      <div>
        <label className="label" htmlFor="startDate">
          Start Date
        </label>
        <input
          id="startDate"
          type="date"
          className="input w-full"
          value={form.startDate}
          onChange={(e) => update("startDate", e.target.value)}
        />
        {errors.startDate && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.startDate}</p>
        )}
      </div>
    </div>
  );
}
