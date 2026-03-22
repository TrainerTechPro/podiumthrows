"use client";

import {
  Pencil,
  Target,
  Disc3,
  Anchor,
  Rocket,
  Calendar,
  Dumbbell,
  Trophy,
  Sparkles,
  Settings2,
} from "lucide-react";
import { SlideToConfirm } from "@/components/ui/SlideToConfirm";
import type { WizardFormState, ExerciseItem } from "../_wizard";

interface StepReviewProps {
  form: WizardFormState;
  update: (field: string, value: unknown) => void;
  errors: Record<string, string>;
  exercises: ExerciseItem[];
  activeSteps: { key: string; label: string }[];
  onEditStep: (stepKey: string) => void;
  onGenerate: () => void;
  generating: boolean;
}

const EVENT_LABELS: Record<string, { label: string; Icon: typeof Target }> = {
  SHOT_PUT: { label: "Shot Put", Icon: Target },
  DISCUS: { label: "Discus", Icon: Disc3 },
  HAMMER: { label: "Hammer", Icon: Anchor },
  JAVELIN: { label: "Javelin", Icon: Rocket },
};

const LEVEL_LABELS: Record<string, string> = {
  HIGH_SCHOOL: "High School",
  COLLEGIATE: "Collegiate",
  POST_COLLEGIATE: "Post-Collegiate",
  ELITE: "Elite / Professional",
};

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

const GOAL_LABELS: Record<string, string> = {
  DISTANCE: "Distance",
  TECHNIQUE: "Technique",
  CONSISTENCY: "Consistency",
};

function SectionHeader({
  title,
  stepKey,
  onEdit,
}: {
  title: string;
  stepKey: string;
  onEdit: (key: string) => void;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">{title}</h3>
      <button
        type="button"
        onClick={() => onEdit(stepKey)}
        className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium inline-flex items-center gap-1"
      >
        <Pencil size={12} strokeWidth={1.75} aria-hidden="true" />
        Edit
      </button>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-1.5">
      <span className="text-sm text-surface-700 dark:text-surface-300">{label}</span>
      <span className="text-sm font-medium text-[var(--foreground)] text-right ml-4">
        {value}
      </span>
    </div>
  );
}

export function StepReview({
  form,
  update: _update,
  errors: _errors,
  exercises,
  activeSteps: _activeSteps,
  onEditStep,
  onGenerate,
  generating,
}: StepReviewProps) {
  const eventInfo = EVENT_LABELS[form.event] || { label: form.event, Icon: Target };

  const selectedExerciseNames = (ids: string[]) =>
    ids
      .map((id) => exercises.find((ex) => ex.id === id)?.name)
      .filter(Boolean)
      .join(", ") || "None";

  return (
    <div className="space-y-6 p-1">
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-1">
          Review Your Program
        </h2>
        <p className="text-body text-surface-700 dark:text-surface-300">
          Review your settings before generating. Click &ldquo;Edit&rdquo; on any section to make
          changes.
        </p>
      </div>

      {/* Program Type */}
      <div className="card p-4">
        <SectionHeader title="Program Type" stepKey="programType" onEdit={onEditStep} />
        <div className="flex items-center gap-2">
          <Dumbbell size={16} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
          <span className="text-sm font-medium text-[var(--foreground)]">
            {form.programType === "THROWS_AND_LIFTING"
              ? "Throws + Lifting"
              : form.programType === "THROWS_ONLY"
                ? "Throws Only"
                : "Not selected"}
          </span>
        </div>
      </div>

      {/* Event & Gender */}
      <div className="card p-4">
        <SectionHeader title="Event & Gender" stepKey="event" onEdit={onEditStep} />
        <div className="flex items-center gap-2">
          <eventInfo.Icon size={16} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
          <span className="text-sm font-medium text-[var(--foreground)]">
            {eventInfo.label} ({form.gender === "MALE" ? "Male" : "Female"})
          </span>
        </div>
      </div>

      {/* Experience */}
      <div className="card p-4">
        <SectionHeader title="Experience" stepKey="experience" onEdit={onEditStep} />
        <div className="divide-y divide-[var(--card-border)]">
          <ReviewRow label="Years throwing" value={`${form.yearsExperience} years`} />
          <ReviewRow label="Level" value={LEVEL_LABELS[form.competitionLevel] || form.competitionLevel} />
          <ReviewRow label="Current PR" value={`${form.currentPR}m`} />
          <ReviewRow label="Goal distance" value={`${form.goalDistance}m`} />
          {form.currentWeeklyVolume && (
            <ReviewRow label="Weekly volume" value={`${form.currentWeeklyVolume} throws/wk`} />
          )}
        </div>
      </div>

      {/* Implements */}
      <div className="card p-4">
        <SectionHeader title="Implements" stepKey="implements" onEdit={onEditStep} />
        <div className="flex flex-wrap gap-1.5">
          {form.selectedImplements
            .sort((a, b) => b - a)
            .map((w) => (
              <span
                key={w}
                className="px-2 py-1 bg-surface-100 dark:bg-surface-800 text-sm font-medium text-[var(--foreground)] rounded-lg"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {w}kg
              </span>
            ))}
          {form.selectedImplements.length === 0 && (
            <span className="text-sm text-muted">None selected</span>
          )}
        </div>
      </div>

      {/* Schedule */}
      <div className="card p-4">
        <SectionHeader title="Schedule" stepKey="schedule" onEdit={onEditStep} />
        <div className="divide-y divide-[var(--card-border)]">
          <ReviewRow label="Days/week" value={form.daysPerWeek} />
          <ReviewRow
            label="Sessions/day"
            value={form.sessionsPerDay === 1 ? "Single" : "Double"}
          />
          <ReviewRow
            label="Training days"
            value={form.preferredDays.map((d) => DAY_LABELS[d] || d).join(", ") || "None"}
          />
          <ReviewRow label="Start date" value={form.startDate || "Not set"} />
        </div>
      </div>

      {/* Competitions */}
      {form.competitions.length > 0 && (
        <div className="card p-4">
          <SectionHeader title="Competitions" stepKey="competitions" onEdit={onEditStep} />
          <div className="space-y-2">
            {form.competitions.map((comp, i) => (
              <div key={i} className="flex items-center gap-3">
                <Trophy size={14} strokeWidth={1.75} className="text-primary-500 flex-shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--foreground)] truncate">
                    {comp.name || "Unnamed"}{" "}
                    <span className="text-muted">({comp.priority})</span>
                  </p>
                  <p className="text-xs text-muted">{comp.date || "No date"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goals & Mode */}
      <div className="card p-4">
        <SectionHeader title="Goals & Mode" stepKey="goals" onEdit={onEditStep} />
        <div className="divide-y divide-[var(--card-border)]">
          <ReviewRow label="Primary goal" value={GOAL_LABELS[form.primaryGoal] || form.primaryGoal} />
          <ReviewRow
            label="Generation mode"
            value={
              <span className="inline-flex items-center gap-1">
                {form.generationMode === "AUTOPILOT" ? (
                  <>
                    <Sparkles size={12} strokeWidth={1.75} aria-hidden="true" /> Autopilot
                  </>
                ) : (
                  <>
                    <Settings2 size={12} strokeWidth={1.75} aria-hidden="true" /> Guided
                  </>
                )}
              </span>
            }
          />
        </div>
      </div>

      {/* Preferences (if guided mode) */}
      {form.generationMode === "GUIDED" && (
        <div className="card p-4">
          <SectionHeader title="Preferences" stepKey="preferences" onEdit={onEditStep} />
          <div className="divide-y divide-[var(--card-border)]">
            <ReviewRow
              label="Preferred"
              value={selectedExerciseNames(form.preferredExercises)}
            />
            <ReviewRow
              label="Avoided"
              value={selectedExerciseNames(form.avoidedExercises)}
            />
            <ReviewRow
              label="Favorite drills"
              value={selectedExerciseNames(form.favoriteDrills)}
            />
          </div>
        </div>
      )}

      {/* Generate section */}
      <div className="pt-2">
        <div className="p-4 bg-primary-50/50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-800 rounded-xl">
          <div className="flex items-start gap-3">
            <Calendar size={20} strokeWidth={1.75} className="text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-primary-800 dark:text-primary-300">
                Ready to Generate
              </p>
              <p className="text-xs text-primary-700 dark:text-primary-400 mt-0.5">
                The Bondarchuk engine will create a periodized macrocycle with phase
                progressions, implement sequencing, and weekly session plans tailored
                to your profile.
              </p>
            </div>
          </div>
        </div>

        {/* Desktop button */}
        <div className="hidden sm:flex justify-end mt-4">
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            className="btn-primary px-6 py-2.5 disabled:opacity-60"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Generating...
              </span>
            ) : (
              "Generate Program"
            )}
          </button>
        </div>

        {/* Mobile slide to confirm */}
        <div className="sm:hidden mt-4">
          <SlideToConfirm
            label="Slide to Generate Program"
            onConfirm={onGenerate}
            disabled={generating}
            variant="confirm"
          />
        </div>
      </div>
    </div>
  );
}
