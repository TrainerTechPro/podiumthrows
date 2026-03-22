"use client";

import { Target, Disc3, Anchor, Rocket } from "lucide-react";
import type { WizardFormState } from "../_wizard";
import { StaggeredList } from "@/components/ui/StaggeredList";

interface StepEventProps {
  form: WizardFormState;
  update: (field: string, value: unknown) => void;
  errors: Record<string, string>;
}

const EVENTS = [
  { value: "SHOT_PUT", label: "Shot Put", icon: Target, color: "#D4915A" },
  { value: "DISCUS", label: "Discus", icon: Disc3, color: "#6A9FD8" },
  { value: "HAMMER", label: "Hammer", icon: Anchor, color: "#5BB88A" },
  { value: "JAVELIN", label: "Javelin", icon: Rocket, color: "#D46A6A" },
] as const;

const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
] as const;

export function StepEvent({ form, update, errors }: StepEventProps) {
  return (
    <div className="space-y-6 p-1">
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-1">
          Event
        </h2>
        <p className="text-body text-surface-700 dark:text-surface-300">
          Which event are you training for?
        </p>
      </div>

      <StaggeredList className="grid grid-cols-2 gap-3">
        {EVENTS.map((event) => {
          const Icon = event.icon;
          const isSelected = form.event === event.value;
          return (
            <button
              key={event.value}
              type="button"
              onClick={() => update("event", event.value)}
              className={`card card-interactive p-4 text-center transition-all ${
                isSelected
                  ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/20"
                  : "border-[var(--card-border)]"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 transition-colors ${
                  isSelected ? "text-white" : "text-surface-700 dark:text-surface-300"
                }`}
                style={
                  isSelected
                    ? { backgroundColor: event.color }
                    : { backgroundColor: "var(--muted-bg)" }
                }
              >
                <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <p className="font-semibold text-sm text-[var(--foreground)]">{event.label}</p>
            </button>
          );
        })}
      </StaggeredList>

      {errors.event && (
        <p className="text-sm text-red-600 dark:text-red-400">{errors.event}</p>
      )}

      {/* Gender Toggle */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2">
          Gender
        </h2>
        <div className="flex rounded-xl border border-[var(--card-border)] overflow-hidden">
          {GENDERS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => update("gender", g.value)}
              className={`flex-1 py-2.5 text-sm font-medium transition-all ${
                form.gender === g.value
                  ? "bg-primary-500 text-white"
                  : "bg-transparent text-surface-700 dark:text-surface-300 hover:bg-[var(--muted-bg)]"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        {errors.gender && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.gender}</p>
        )}
      </div>
    </div>
  );
}
