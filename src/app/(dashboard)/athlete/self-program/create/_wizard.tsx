"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { SlideToConfirm } from "@/components/ui/SlideToConfirm";
import { useToast } from "@/components/ui/Toast";

import { StepProgramType } from "./_steps/step-program-type";
import { StepEvent } from "./_steps/step-event";
import { StepExperience } from "./_steps/step-experience";
import { StepImplements } from "./_steps/step-implements";
import { StepTyping } from "./_steps/step-typing";
import { StepSchedule } from "./_steps/step-schedule";
import { StepCompetitions } from "./_steps/step-competitions";
import { StepGoals } from "./_steps/step-goals";
import { StepPreferences } from "./_steps/step-preferences";
import { StepReview } from "./_steps/step-review";

// ── Types ───────────────────────────────────────────────────────────────

export interface ExerciseItem {
  id: string;
  name: string;
  category: string;
  event: string | null;
  implementWeight: number | null;
}

export interface CompetitionEntry {
  date: string;
  name: string;
  priority: "A" | "B" | "C";
}

export interface WizardFormState {
  programType: "THROWS_ONLY" | "THROWS_AND_LIFTING" | "";
  event: string;
  gender: string;
  yearsExperience: string;
  competitionLevel: string;
  currentPR: string;
  goalDistance: string;
  currentWeeklyVolume: string;
  selectedImplements: number[];
  adaptationSpeed: number;
  transferType: string;
  recoveryProfile: string;
  daysPerWeek: number;
  sessionsPerDay: number;
  preferredDays: string[];
  startDate: string;
  competitions: CompetitionEntry[];
  primaryGoal: string;
  generationMode: string;
  preferredExercises: string[];
  avoidedExercises: string[];
  favoriteDrills: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DraftData = Record<string, any> | null;

interface SelfProgramWizardProps {
  athleteId: string;
  athleteEvents: string[];
  athleteGender: string;
  athleteWeightKg: number | null;
  hasTypingData: boolean;
  existingImplements: string | null;
  exercises: ExerciseItem[];
  draft: DraftData;
}

// ── Step Configuration ─────────────────────────────────────────────────

interface StepConfig {
  key: string;
  label: string;
  skip?: (form: WizardFormState, hasTyping: boolean) => boolean;
}

const ALL_STEPS: StepConfig[] = [
  { key: "programType", label: "Program Type" },
  { key: "event", label: "Event & Gender" },
  { key: "experience", label: "Experience" },
  { key: "implements", label: "Implements" },
  {
    key: "typing",
    label: "Athlete Typing",
    skip: (_form, hasTyping) => hasTyping,
  },
  { key: "schedule", label: "Schedule" },
  { key: "competitions", label: "Competitions" },
  { key: "goals", label: "Goals & Mode" },
  {
    key: "preferences",
    label: "Preferences",
    skip: (form) => form.generationMode === "AUTOPILOT",
  },
  { key: "review", label: "Review" },
];

function buildDefaultForm(
  athleteEvents: string[],
  athleteGender: string,
  draft: DraftData
): WizardFormState {
  if (draft) {
    return {
      programType: draft.programType || "",
      event: draft.event || (athleteEvents[0] || ""),
      gender: draft.gender || athleteGender || "",
      yearsExperience: draft.yearsExperience?.toString() || "",
      competitionLevel: draft.competitionLevel || "",
      currentPR: draft.currentPR?.toString() || "",
      goalDistance: draft.goalDistance?.toString() || "",
      currentWeeklyVolume: draft.currentWeeklyVolume?.toString() || "",
      selectedImplements: Array.isArray(draft.availableImplements)
        ? (draft.availableImplements as { weightKg: number }[]).map((i) => i.weightKg)
        : [],
      adaptationSpeed: (draft.inlineTypingData as { adaptationSpeed?: number } | null)?.adaptationSpeed ?? 2,
      transferType: (draft.inlineTypingData as { transferType?: string } | null)?.transferType ?? "BALANCED",
      recoveryProfile: (draft.inlineTypingData as { recoveryProfile?: string } | null)?.recoveryProfile ?? "MODERATE",
      daysPerWeek: draft.daysPerWeek || 4,
      sessionsPerDay: draft.sessionsPerDay || 1,
      preferredDays: Array.isArray(draft.preferredDays) ? draft.preferredDays : [],
      startDate: draft.startDate ? new Date(draft.startDate).toISOString().split("T")[0] : "",
      competitions: Array.isArray(draft.competitionDates)
        ? (draft.competitionDates as CompetitionEntry[])
        : [],
      primaryGoal: draft.primaryGoal || "",
      generationMode: draft.generationMode || "",
      preferredExercises: (draft.exercisePreferences as { preferred?: string[] } | null)?.preferred ?? [],
      avoidedExercises: (draft.exercisePreferences as { avoided?: string[] } | null)?.avoided ?? [],
      favoriteDrills: (draft.exercisePreferences as { favoriteDrills?: string[] } | null)?.favoriteDrills ?? [],
    };
  }

  return {
    programType: "",
    event: athleteEvents[0] || "",
    gender: athleteGender || "",
    yearsExperience: "",
    competitionLevel: "",
    currentPR: "",
    goalDistance: "",
    currentWeeklyVolume: "",
    selectedImplements: [],
    adaptationSpeed: 2,
    transferType: "BALANCED",
    recoveryProfile: "MODERATE",
    daysPerWeek: 4,
    sessionsPerDay: 1,
    preferredDays: [],
    startDate: "",
    competitions: [],
    primaryGoal: "",
    generationMode: "",
    preferredExercises: [],
    avoidedExercises: [],
    favoriteDrills: [],
  };
}

// ── Main Wizard Component ──────────────────────────────────────────────

export function SelfProgramWizard({
  athleteId,
  athleteEvents,
  athleteGender,
  athleteWeightKg: _athleteWeightKg,
  hasTypingData,
  existingImplements,
  exercises,
  draft,
}: SelfProgramWizardProps) {
  const router = useRouter();
  const { success, error: toastError, celebration } = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardFormState>(() =>
    buildDefaultForm(athleteEvents, athleteGender, draft)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(
    (draft as { id?: string } | null)?.id ?? null
  );

  // ── Active steps (filtered by skip conditions) ───────────────────

  const activeSteps = useMemo(
    () => ALL_STEPS.filter((s) => !s.skip?.(form, hasTypingData)),
    [form, hasTypingData]
  );

  const currentStepConfig = activeSteps[step];
  const totalSteps = activeSteps.length;
  const isLastStep = step === totalSteps - 1;

  // ── Form update ──────────────────────────────────────────────────

  const update = useCallback((field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // ── Step Validation ──────────────────────────────────────────────

  function validateStep(stepIndex: number): boolean {
    const errs: Record<string, string> = {};
    const stepKey = activeSteps[stepIndex]?.key;

    switch (stepKey) {
      case "programType":
        if (!form.programType) errs.programType = "Select a program type";
        break;

      case "event":
        if (!form.event) errs.event = "Select an event";
        if (!form.gender) errs.gender = "Select gender";
        break;

      case "experience":
        if (!form.yearsExperience || parseFloat(form.yearsExperience) < 0)
          errs.yearsExperience = "Enter years of experience";
        if (!form.competitionLevel) errs.competitionLevel = "Select competition level";
        if (!form.currentPR || parseFloat(form.currentPR) <= 0)
          errs.currentPR = "Enter your current PR";
        if (!form.goalDistance || parseFloat(form.goalDistance) <= 0)
          errs.goalDistance = "Enter a goal distance";
        if (
          form.currentPR &&
          form.goalDistance &&
          parseFloat(form.goalDistance) <= parseFloat(form.currentPR)
        )
          errs.goalDistance = "Goal must exceed current PR";
        break;

      case "implements":
        if (form.selectedImplements.length === 0)
          errs.implements = "Select at least one implement";
        if (form.selectedImplements.length < 2)
          errs.implements = "Select at least 2 implements for optimal training";
        break;

      case "typing":
        // Typing step always valid — defaults are fine
        break;

      case "schedule":
        if (form.preferredDays.length === 0) errs.preferredDays = "Select at least one training day";
        if (form.preferredDays.length < form.daysPerWeek)
          errs.preferredDays = `Select at least ${form.daysPerWeek} days`;
        if (!form.startDate) errs.startDate = "Select a start date";
        break;

      case "competitions":
        // Competitions are optional
        break;

      case "goals":
        if (!form.primaryGoal) errs.primaryGoal = "Select a primary goal";
        if (!form.generationMode) errs.generationMode = "Select a generation mode";
        break;

      case "preferences":
        // Preferences are optional
        break;

      case "review":
        // Review step — no additional validation
        break;
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Navigation ───────────────────────────────────────────────────

  function nextStep() {
    if (validateStep(step)) {
      saveDraft();
      setStep((s) => Math.min(s + 1, totalSteps - 1));
    }
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function goToStep(targetStepKey: string) {
    const idx = activeSteps.findIndex((s) => s.key === targetStepKey);
    if (idx >= 0) setStep(idx);
  }

  // ── Draft Auto-save ──────────────────────────────────────────────

  async function saveDraft() {
    try {
      const body = {
        athleteProfileId: athleteId,
        programType: form.programType,
        event: form.event,
        gender: form.gender,
        yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience) : 0,
        competitionLevel: form.competitionLevel,
        currentPR: form.currentPR ? parseFloat(form.currentPR) : 0,
        goalDistance: form.goalDistance ? parseFloat(form.goalDistance) : 0,
        currentWeeklyVolume: form.currentWeeklyVolume
          ? parseInt(form.currentWeeklyVolume)
          : null,
        availableImplements: form.selectedImplements.map((w) => ({ weightKg: w })),
        daysPerWeek: form.daysPerWeek,
        sessionsPerDay: form.sessionsPerDay,
        preferredDays: form.preferredDays,
        startDate: form.startDate || null,
        competitionDates: form.competitions.length > 0 ? form.competitions : null,
        primaryGoal: form.primaryGoal,
        generationMode: form.generationMode,
        exercisePreferences:
          form.preferredExercises.length > 0 ||
          form.avoidedExercises.length > 0 ||
          form.favoriteDrills.length > 0
            ? {
                preferred: form.preferredExercises,
                avoided: form.avoidedExercises,
                favoriteDrills: form.favoriteDrills,
              }
            : null,
        inlineTypingData: !hasTypingData
          ? {
              adaptationSpeed: form.adaptationSpeed,
              transferType: form.transferType,
              recoveryProfile: form.recoveryProfile,
            }
          : null,
        usedExistingTyping: hasTypingData,
        isDraft: true,
      };

      const url = draftId
        ? `/api/athlete/self-program/${draftId}/draft`
        : `/api/athlete/self-program/draft`;

      const res = await fetch(url, {
        method: draftId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.id && !draftId) setDraftId(data.id);
      }
    } catch {
      // Draft save failures are non-critical — silently continue
    }
  }

  // ── Generate Program ─────────────────────────────────────────────

  async function handleGenerate() {
    if (!validateStep(step)) return;
    setGenerating(true);
    setErrors({});

    try {
      const payload = {
        athleteProfileId: athleteId,
        programType: form.programType,
        event: form.event,
        gender: form.gender,
        yearsExperience: parseInt(form.yearsExperience),
        competitionLevel: form.competitionLevel,
        currentPR: parseFloat(form.currentPR),
        goalDistance: parseFloat(form.goalDistance),
        currentWeeklyVolume: form.currentWeeklyVolume
          ? parseInt(form.currentWeeklyVolume)
          : null,
        availableImplements: form.selectedImplements.map((w) => ({ weightKg: w })),
        daysPerWeek: form.daysPerWeek,
        sessionsPerDay: form.sessionsPerDay,
        preferredDays: form.preferredDays,
        startDate: form.startDate,
        competitionDates: form.competitions.length > 0 ? form.competitions : null,
        primaryGoal: form.primaryGoal,
        generationMode: form.generationMode,
        exercisePreferences: {
          preferred: form.preferredExercises,
          avoided: form.avoidedExercises,
          favoriteDrills: form.favoriteDrills,
        },
        inlineTypingData: !hasTypingData
          ? {
              adaptationSpeed: form.adaptationSpeed,
              transferType: form.transferType,
              recoveryProfile: form.recoveryProfile,
            }
          : null,
        usedExistingTyping: hasTypingData,
        draftId: draftId,
      };

      const res = await fetch("/api/athlete/self-program/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        setErrors({ generate: err.error || "Failed to generate program" });
        toastError("Generation Failed", err.error || "Something went wrong");
        return;
      }

      const data = await res.json();
      celebration("Program Generated!", {
        description: "Your Bondarchuk-based training program is ready",
        highlight: `${data.totalWeeks} weeks`,
      });
      success("Program created successfully");
      router.push(`/athlete/self-program/${data.programId}`);
    } catch {
      setErrors({ generate: "Something went wrong. Please try again." });
      toastError("Error", "Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <ScrollProgressBar />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/athlete/self-program"
            className="text-muted hover:text-[var(--foreground)] transition-colors"
            aria-label="Back to self program"
          >
            <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <h1 className="text-title font-heading text-[var(--foreground)]">
            Build Your Program
          </h1>
        </div>
        <p className="text-body text-surface-700 dark:text-surface-300 mt-1">
          Create a Bondarchuk-based periodized training program tailored to you
        </p>
      </div>

      {/* Step Progress Indicator */}
      <div className="mb-8">
        {/* Step circles with connecting lines */}
        <div className="flex items-center justify-between mb-2">
          {activeSteps.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => {
                  if (i < step) setStep(i);
                }}
                disabled={i > step}
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all flex-shrink-0 ${
                  i === step
                    ? "bg-primary-500 text-black shadow-md"
                    : i < step
                      ? "bg-[rgba(212,168,67,0.2)] text-primary-600 dark:text-primary-500 cursor-pointer"
                      : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300"
                }`}
                aria-label={`Step ${i + 1}: ${s.label}`}
              >
                {i < step ? (
                  <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  i + 1
                )}
              </button>
              {/* Connecting line */}
              {i < activeSteps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${
                    i < step ? "bg-primary-500/40" : "bg-[var(--muted-bg)]"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-[var(--muted-bg)] rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>
        <p className="text-caption text-surface-700 dark:text-surface-300 mt-2 text-center">
          Step {step + 1} of {totalSteps}: {currentStepConfig?.label}
        </p>
      </div>

      {/* Step Content */}
      <div className="card">
        <div className="animate-fade-slide-in" key={currentStepConfig?.key}>
          {currentStepConfig?.key === "programType" && (
            <StepProgramType form={form} update={update} errors={errors} />
          )}
          {currentStepConfig?.key === "event" && (
            <StepEvent form={form} update={update} errors={errors} />
          )}
          {currentStepConfig?.key === "experience" && (
            <StepExperience form={form} update={update} errors={errors} />
          )}
          {currentStepConfig?.key === "implements" && (
            <StepImplements
              form={form}
              update={update}
              errors={errors}
              existingImplements={existingImplements}
            />
          )}
          {currentStepConfig?.key === "typing" && (
            <StepTyping form={form} update={update} errors={errors} />
          )}
          {currentStepConfig?.key === "schedule" && (
            <StepSchedule form={form} update={update} errors={errors} />
          )}
          {currentStepConfig?.key === "competitions" && (
            <StepCompetitions form={form} update={update} errors={errors} />
          )}
          {currentStepConfig?.key === "goals" && (
            <StepGoals form={form} update={update} errors={errors} />
          )}
          {currentStepConfig?.key === "preferences" && (
            <StepPreferences
              form={form}
              update={update}
              errors={errors}
              exercises={exercises}
            />
          )}
          {currentStepConfig?.key === "review" && (
            <StepReview
              form={form}
              update={update}
              errors={errors}
              exercises={exercises}
              activeSteps={activeSteps}
              onEditStep={goToStep}
              onGenerate={handleGenerate}
              generating={generating}
            />
          )}
        </div>
      </div>

      {/* Error */}
      {errors.generate && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">
          {errors.generate}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          onClick={prevStep}
          disabled={step === 0}
          className="btn-secondary px-5 py-2.5 disabled:opacity-40"
        >
          Back
        </button>

        {isLastStep ? (
          <>
            {/* Desktop generate button */}
            <div className="hidden sm:flex">
              <button
                type="button"
                onClick={handleGenerate}
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
            <div className="sm:hidden flex-1 ml-4">
              <SlideToConfirm
                label="Slide to Generate Program"
                onConfirm={handleGenerate}
                disabled={generating}
                variant="confirm"
              />
            </div>
          </>
        ) : (
          <button type="button" onClick={nextStep} className="btn-primary px-6 py-2.5">
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
