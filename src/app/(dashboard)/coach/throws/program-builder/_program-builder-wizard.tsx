"use client";

import { useState, useCallback } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import Link from "next/link";
import { GeneratingOverlay } from "@/components/throws/GeneratingOverlay";

// ── Types ───────────────────────────────────────────────────────────────

type ThrowEvent = "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";
type Gender = "MALE" | "FEMALE";

interface AthletePickerItem {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  events: string[];
}

interface ImplementOption {
  weight: string;
  weightKg: number;
  isCompetition: boolean;
  label: string;
}

interface ProgramSummary {
  totalPhases: number;
  totalSessions: number;
  estimatedTotalThrows: number;
  phaseBreakdown: Array<{
    phase: string;
    weeks: number;
    throwsPerWeek: number;
  }>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface SandboxGenerated {
  phases: any[];
  totalWeeks: number;
  summary: ProgramSummary;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

type GeneratedResult =
  | { mode: "real"; programId: string; totalWeeks: number; summary: ProgramSummary }
  | { mode: "sandbox"; generated: SandboxGenerated };

// ── Constants ───────────────────────────────────────────────────────────

const EVENTS = [
  { value: "SHOT_PUT", label: "Shot Put", color: "#D4915A" },
  { value: "DISCUS", label: "Discus", color: "#6A9FD8" },
  { value: "HAMMER", label: "Hammer Throw", color: "#5BB88A" },
  { value: "JAVELIN", label: "Javelin", color: "#D46A6A" },
] as const;

const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
] as const;

const IMPLEMENTS_MAP: Record<ThrowEvent, Record<Gender, ImplementOption[]>> = {
  SHOT_PUT: {
    MALE: [
      { weight: "11kg", weightKg: 11, isCompetition: false, label: "11kg (extra heavy)" },
      { weight: "10kg", weightKg: 10, isCompetition: false, label: "10kg (extra heavy)" },
      { weight: "9kg", weightKg: 9, isCompetition: false, label: "9kg (heavy)" },
      { weight: "8kg", weightKg: 8, isCompetition: false, label: "8kg (heavy)" },
      { weight: "7.26kg", weightKg: 7.26, isCompetition: true, label: "7.26kg (competition)" },
      { weight: "6kg", weightKg: 6, isCompetition: false, label: "6kg (light)" },
      { weight: "5kg", weightKg: 5, isCompetition: false, label: "5kg (light)" },
    ],
    FEMALE: [
      { weight: "7.26kg", weightKg: 7.26, isCompetition: false, label: "7.26kg (heavy)" },
      { weight: "6kg", weightKg: 6, isCompetition: false, label: "6kg (heavy)" },
      { weight: "5kg", weightKg: 5, isCompetition: false, label: "5kg (heavy)" },
      { weight: "4kg", weightKg: 4, isCompetition: true, label: "4kg (competition)" },
      { weight: "3.5kg", weightKg: 3.5, isCompetition: false, label: "3.5kg (light)" },
      { weight: "3kg", weightKg: 3, isCompetition: false, label: "3kg (light)" },
    ],
  },
  DISCUS: {
    MALE: [
      { weight: "2.75kg", weightKg: 2.75, isCompetition: false, label: "2.75kg (heavy)" },
      { weight: "2.5kg", weightKg: 2.5, isCompetition: false, label: "2.5kg (heavy)" },
      { weight: "2.25kg", weightKg: 2.25, isCompetition: false, label: "2.25kg (heavy)" },
      { weight: "2kg", weightKg: 2, isCompetition: true, label: "2kg (competition)" },
      { weight: "1.8kg", weightKg: 1.8, isCompetition: false, label: "1.8kg (light)" },
      { weight: "1.75kg", weightKg: 1.75, isCompetition: false, label: "1.75kg (light)" },
      { weight: "1.5kg", weightKg: 1.5, isCompetition: false, label: "1.5kg (light)" },
    ],
    FEMALE: [
      { weight: "2kg", weightKg: 2, isCompetition: false, label: "2kg (heavy)" },
      { weight: "1.75kg", weightKg: 1.75, isCompetition: false, label: "1.75kg (heavy)" },
      { weight: "1.5kg", weightKg: 1.5, isCompetition: false, label: "1.5kg (heavy)" },
      { weight: "1.25kg", weightKg: 1.25, isCompetition: false, label: "1.25kg (heavy)" },
      { weight: "1kg", weightKg: 1, isCompetition: true, label: "1kg (competition)" },
      { weight: "0.75kg", weightKg: 0.75, isCompetition: false, label: "0.75kg (light)" },
    ],
  },
  HAMMER: {
    MALE: [
      { weight: "10kg", weightKg: 10, isCompetition: false, label: "10kg (heavy)" },
      { weight: "9kg", weightKg: 9, isCompetition: false, label: "9kg (heavy)" },
      { weight: "8kg", weightKg: 8, isCompetition: false, label: "8kg (heavy)" },
      { weight: "7.26kg", weightKg: 7.26, isCompetition: true, label: "7.26kg (competition)" },
      { weight: "6kg", weightKg: 6, isCompetition: false, label: "6kg (light)" },
      { weight: "5kg", weightKg: 5, isCompetition: false, label: "5kg (light)" },
    ],
    FEMALE: [
      { weight: "6kg", weightKg: 6, isCompetition: false, label: "6kg (heavy)" },
      { weight: "5kg", weightKg: 5, isCompetition: false, label: "5kg (heavy)" },
      { weight: "4kg", weightKg: 4, isCompetition: true, label: "4kg (competition)" },
      { weight: "3.5kg", weightKg: 3.5, isCompetition: false, label: "3.5kg (light)" },
      { weight: "3kg", weightKg: 3, isCompetition: false, label: "3kg (light)" },
    ],
  },
  JAVELIN: {
    MALE: [
      { weight: "1100g", weightKg: 1.1, isCompetition: false, label: "1100g (heavy)" },
      { weight: "1000g", weightKg: 1, isCompetition: false, label: "1000g (heavy)" },
      { weight: "900g", weightKg: 0.9, isCompetition: false, label: "900g (heavy)" },
      { weight: "800g", weightKg: 0.8, isCompetition: true, label: "800g (competition)" },
      { weight: "700g", weightKg: 0.7, isCompetition: false, label: "700g (light)" },
      { weight: "600g", weightKg: 0.6, isCompetition: false, label: "600g (light)" },
    ],
    FEMALE: [
      { weight: "900g", weightKg: 0.9, isCompetition: false, label: "900g (heavy)" },
      { weight: "800g", weightKg: 0.8, isCompetition: false, label: "800g (heavy)" },
      { weight: "700g", weightKg: 0.7, isCompetition: false, label: "700g (heavy)" },
      { weight: "600g", weightKg: 0.6, isCompetition: true, label: "600g (competition)" },
      { weight: "500g", weightKg: 0.5, isCompetition: false, label: "500g (light)" },
      { weight: "400g", weightKg: 0.4, isCompetition: false, label: "400g (light)" },
    ],
  },
};

const IMPLEMENT_TYPE_MAP: Record<ThrowEvent, string> = {
  SHOT_PUT: "shot",
  DISCUS: "disc",
  HAMMER: "hammer",
  JAVELIN: "jav",
};

const GYM_EQUIPMENT_OPTIONS = [
  { key: "barbell", label: "Barbell" },
  { key: "squatRack", label: "Squat Rack" },
  { key: "platform", label: "Lifting Platform" },
  { key: "dumbbells", label: "Dumbbells" },
  { key: "cables", label: "Cable Machine" },
  { key: "medBalls", label: "Medicine Balls" },
  { key: "boxes", label: "Plyo Boxes" },
  { key: "bands", label: "Resistance Bands" },
];

const PHASES = [
  { value: "ACCUMULATION", label: "Accumulation (GPP)" },
  { value: "TRANSMUTATION", label: "Transmutation (SPP)" },
  { value: "REALIZATION", label: "Realization" },
  { value: "COMPETITION", label: "Competition" },
];

const STEPS_REAL = [
  "Athlete",
  "Event & PR",
  "Goal & Schedule",
  "Equipment",
  "Lifting & Experience",
  "Review",
];

const STEPS_SANDBOX = [
  "Test Profile",
  "Event & PR",
  "Goal & Schedule",
  "Equipment",
  "Lifting & Experience",
  "Preview",
];

const PHASE_COLORS: Record<string, string> = {
  ACCUMULATION: "#5BB88A",
  TRANSMUTATION: "#6A9FD8",
  REALIZATION: "#D4915A",
  COMPETITION: "#D46A6A",
};

const DAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CLASSIFICATION_COLORS: Record<string, { bg: string; text: string }> = {
  CE: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300" },
  SD: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300" },
  SP: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-800 dark:text-green-300" },
  GP: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-800 dark:text-purple-300" },
};

// ── Form State ──────────────────────────────────────────────────────────

interface FormState {
  selectedAthleteId: string;
  event: ThrowEvent | "";
  gender: Gender | "";
  distanceUnit: "meters" | "feet";
  competitionPr: string;
  goalDistance: string;
  targetDate: string;
  daysPerWeek: number;
  sessionsPerDay: number;
  includeLift: boolean;
  selectedImplements: number[];
  hasCage: boolean;
  hasRing: boolean;
  hasFieldAccess: boolean;
  hasGym: boolean;
  gymEquipment: Record<string, boolean>;
  squatKg: string;
  benchKg: string;
  cleanKg: string;
  snatchKg: string;
  ohpKg: string;
  deadliftKg: string;
  bodyWeightKg: string;
  yearsThrowing: string;
  currentWeeklyVolume: string;
  currentPhase: string;
  hasTyping: boolean;
  adaptationGroup: number;
  sessionsToForm: number;
  recommendedMethod: string;
}

const DEFAULT_FORM: FormState = {
  selectedAthleteId: "",
  event: "",
  gender: "",
  distanceUnit: "meters",
  competitionPr: "",
  goalDistance: "",
  targetDate: "",
  daysPerWeek: 4,
  sessionsPerDay: 1,
  includeLift: true,
  selectedImplements: [],
  hasCage: true,
  hasRing: true,
  hasFieldAccess: true,
  hasGym: true,
  gymEquipment: {
    barbell: true,
    squatRack: true,
    platform: false,
    dumbbells: true,
    cables: false,
    medBalls: false,
    boxes: false,
    bands: false,
  },
  squatKg: "",
  benchKg: "",
  cleanKg: "",
  snatchKg: "",
  ohpKg: "",
  deadliftKg: "",
  bodyWeightKg: "",
  yearsThrowing: "",
  currentWeeklyVolume: "",
  currentPhase: "",
  hasTyping: false,
  adaptationGroup: 2,
  sessionsToForm: 25,
  recommendedMethod: "complex",
};

// ── Main Wizard ─────────────────────────────────────────────────────────

export function ProgramBuilderWizard({
  athletes,
}: {
  athletes: AthletePickerItem[];
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [sandboxName, setSandboxName] = useState("Test Athlete");

  const update = useCallback(
    (field: keyof FormState, value: FormState[keyof FormState]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [],
  );

  // ── Prefill from selected athlete ────────────────────────────────

  async function handleSelectAthlete(athleteId: string) {
    update("selectedAthleteId", athleteId);
    setLoading(true);
    try {
      const res = await fetch(`/api/throws/program/prefill/${athleteId}`);
      if (res.ok) {
        const { data } = await res.json();
        const p = data?.prefill;
        if (p) {
          setForm((prev) => ({
            ...prev,
            selectedAthleteId: athleteId,
            event: p.event || "",
            gender: p.gender || "",
            competitionPr: p.competitionPr?.toString() || "",
            // Equipment
            selectedImplements: (p.implements || []).map(
              (i: { weightKg: number }) => i.weightKg,
            ),
            hasCage: p.facilities?.hasCage ?? true,
            hasRing: p.facilities?.hasRing ?? true,
            hasFieldAccess: p.facilities?.hasFieldAccess ?? true,
            hasGym: p.facilities?.hasGym ?? true,
            gymEquipment: p.facilities?.gymEquipment ?? prev.gymEquipment,
            // Lifting
            squatKg: p.liftingPrs?.squatKg?.toString() || "",
            benchKg: p.liftingPrs?.benchKg?.toString() || "",
            cleanKg: p.liftingPrs?.cleanKg?.toString() || "",
            snatchKg: p.liftingPrs?.snatchKg?.toString() || "",
            ohpKg: p.liftingPrs?.ohpKg?.toString() || "",
            deadliftKg: p.liftingPrs?.deadliftKg?.toString() || "",
            bodyWeightKg: p.liftingPrs?.bodyWeightKg?.toString() || "",
            // Typing
            hasTyping: p.hasTyping || false,
            adaptationGroup: p.typing?.adaptationGroup ?? 2,
            sessionsToForm: p.typing?.sessionsToForm ?? 25,
            recommendedMethod: p.typing?.recommendedMethod ?? "complex",
          }));
        }
      }
    } catch {
      // Silently fail — coach fills manually
    } finally {
      setLoading(false);
    }
  }

  // ── Step Validation ───────────────────────────────────────────────

  function validateStep(s: number): boolean {
    const errs: Record<string, string> = {};

    if (s === 0) {
      if (!sandboxMode && !form.selectedAthleteId) errs.athlete = "Select an athlete";
    }

    if (s === 1) {
      if (!form.event) errs.event = "Select an event";
      if (!form.gender) errs.gender = "Select gender";
      if (!form.competitionPr || parseFloat(form.competitionPr) <= 0)
        errs.competitionPr = "Enter competition PR";
    }

    if (s === 2) {
      if (!form.goalDistance || parseFloat(form.goalDistance) <= 0)
        errs.goalDistance = "Enter a goal distance";
      if (!form.targetDate) errs.targetDate = "Select a target date";
      if (form.targetDate && new Date(form.targetDate) < new Date())
        errs.targetDate = "Target date must be in the future";
    }

    if (s === 3) {
      if (form.selectedImplements.length === 0)
        errs.implements = "Select at least one implement";
    }

    if (s === 4) {
      if (!form.yearsThrowing || parseFloat(form.yearsThrowing) < 0)
        errs.yearsThrowing = "Enter years of throwing experience";
      if (!form.bodyWeightKg || parseFloat(form.bodyWeightKg) <= 0)
        errs.bodyWeightKg = "Enter body weight";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const STEPS = sandboxMode ? STEPS_SANDBOX : STEPS_REAL;

  function nextStep() {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 0));
  }

  // ── Generate Program ──────────────────────────────────────────────

  async function handleGenerate() {
    if (!validateStep(4)) return; // re-validate lifting/experience
    setGenerating(true);
    setErrors({});

    try {
      const ev = form.event as ThrowEvent;
      const gen = form.gender as Gender;
      const implType = IMPLEMENT_TYPE_MAP[ev];

      const toM = (v: number) => form.distanceUnit === "feet" ? v * 0.3048 : v;

      const payload = {
        athleteId: form.selectedAthleteId,
        onboardingData: {
          event: ev,
          gender: gen,
          competitionPr: toM(parseFloat(form.competitionPr)),
          goalDistance: toM(parseFloat(form.goalDistance)),
          targetDate: form.targetDate,
          implements: form.selectedImplements.map((wKg) => ({
            weightKg: wKg,
            type: implType,
          })),
          facilities: {
            hasCage: form.hasCage,
            hasRing: form.hasRing,
            hasFieldAccess: form.hasFieldAccess,
            hasGym: form.hasGym,
            gymEquipment: form.gymEquipment,
          },
          liftingPrs: {
            squatKg: form.squatKg ? parseFloat(form.squatKg) : undefined,
            benchKg: form.benchKg ? parseFloat(form.benchKg) : undefined,
            cleanKg: form.cleanKg ? parseFloat(form.cleanKg) : undefined,
            snatchKg: form.snatchKg ? parseFloat(form.snatchKg) : undefined,
            ohpKg: form.ohpKg ? parseFloat(form.ohpKg) : undefined,
            deadliftKg: form.deadliftKg
              ? parseFloat(form.deadliftKg)
              : undefined,
            bodyWeightKg: parseFloat(form.bodyWeightKg),
          },
          schedule: {
            daysPerWeek: form.daysPerWeek,
            sessionsPerDay: form.sessionsPerDay,
            includeLift: form.includeLift,
          },
          experience: {
            yearsThrowing: parseFloat(form.yearsThrowing),
            currentWeeklyVolume: form.currentWeeklyVolume
              ? parseInt(form.currentWeeklyVolume)
              : undefined,
            currentPhase: form.currentPhase || undefined,
          },
          typing: form.hasTyping
            ? {
                adaptationGroup: form.adaptationGroup,
                sessionsToForm: form.sessionsToForm,
                recommendedMethod: form.recommendedMethod,
              }
            : undefined,
        },
      };

      if (sandboxMode) {
        // Sandbox mode: preview only, no DB save
        const res = await fetch("/api/throws/program/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ onboardingData: payload.onboardingData }),
        });

        if (!res.ok) {
          const err = await res.json();
          setErrors({ generate: err.error || "Failed to generate preview" });
          setGenerating(false);
          return;
        }

        const { data } = await res.json();
        setGeneratedResult({ mode: "sandbox", generated: data.generated });
      } else {
        // Real mode: generate and save to DB
        const res = await fetch("/api/throws/program/generate-for-athlete", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          setErrors({ generate: err.error || "Failed to generate program" });
          setGenerating(false);
          return;
        }

        const { data } = await res.json();
        setGeneratedResult({ mode: "real", ...data });
      }
    } catch {
      setErrors({ generate: "Something went wrong. Please try again." });
    } finally {
      setGenerating(false);
    }
  }

  // ── Implement options for current event/gender ────────────────────

  const implementOptions: ImplementOption[] =
    form.event && form.gender
      ? (IMPLEMENTS_MAP[form.event as ThrowEvent]?.[form.gender as Gender] ??
        [])
      : [];

  // ── Selected athlete name for display ─────────────────────────────

  const selectedAthlete = athletes.find(
    (a) => a.id === form.selectedAthleteId,
  );
  const athleteName = selectedAthlete
    ? `${selectedAthlete.firstName} ${selectedAthlete.lastName}`
    : "";
  const displayName = sandboxMode ? sandboxName : athleteName;

  // ── Render ────────────────────────────────────────────────────────

  return (
    <>
      <GeneratingOverlay isGenerating={generating} />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/coach/throws"
            className="text-muted hover:text-[var(--foreground)] transition-colors"
            aria-label="Back to throws"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="text-title font-heading text-[var(--foreground)]">
            Build Training Program
          </h1>
        </div>
        <p className="text-body text-surface-700 dark:text-surface-300 mt-1">
          {sandboxMode
            ? "Explore the Bondarchuk engine with a test profile"
            : "Generate a Bondarchuk-based periodized program for an athlete"}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((label, i) => (
            <button
              key={label}
              onClick={() => {
                if (i < step) setStep(i);
              }}
              className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all ${
                i === step
                  ? "bg-primary-500 text-black shadow-md"
                  : i < step
                    ? "bg-[rgba(212,168,67,0.2)] text-primary-600 dark:text-primary-500 cursor-pointer"
                    : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300"
              }`}
            >
              {i < step ? (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                i + 1
              )}
            </button>
          ))}
        </div>
        <div className="h-1.5 bg-[var(--muted-bg)] rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <p className="text-caption text-surface-700 dark:text-surface-300 mt-2 text-center">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
      </div>

      {/* Loading overlay for prefill */}
      {loading && (
        <div className="card flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-surface-700 dark:text-surface-300">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
            Loading athlete data...
          </div>
        </div>
      )}

      {/* Step Content */}
      {!loading && (
        <div className="card">
          {step === 0 && (
            <StepSelectAthleteOrTest
              athletes={athletes}
              selectedId={form.selectedAthleteId}
              onSelect={handleSelectAthlete}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              errors={errors}
              sandboxMode={sandboxMode}
              sandboxName={sandboxName}
              onToggleMode={(sandbox) => {
                setSandboxMode(sandbox);
                if (sandbox) {
                  setForm((prev) => ({ ...prev, selectedAthleteId: "" }));
                }
              }}
              onSandboxNameChange={setSandboxName}
            />
          )}
          {step === 1 && (
            <StepEventPr form={form} update={update} errors={errors} />
          )}
          {step === 2 && (
            <StepGoalSchedule form={form} update={update} errors={errors} />
          )}
          {step === 3 && (
            <StepEquipment
              form={form}
              update={update}
              errors={errors}
              options={implementOptions}
            />
          )}
          {step === 4 && (
            <StepLiftingExperience
              form={form}
              update={update}
              errors={errors}
            />
          )}
          {step === 5 && !generatedResult && (
            <StepReview
              form={form}
              athleteName={displayName}
              implementOptions={implementOptions}
              isSandbox={sandboxMode}
            />
          )}
          {step === 5 && generatedResult?.mode === "real" && (
            <ProgramSummaryCard
              result={generatedResult}
              athleteName={athleteName}
              onReset={() => {
                setForm(DEFAULT_FORM);
                setGeneratedResult(null);
                setStep(0);
                setSearchQuery("");
              }}
            />
          )}
          {step === 5 && generatedResult?.mode === "sandbox" && (
            <SandboxPreviewCard
              generated={generatedResult.generated}
              profileName={sandboxName}
              form={form}
              implementOptions={implementOptions}
              onReset={() => {
                setForm(DEFAULT_FORM);
                setGeneratedResult(null);
                setSandboxMode(false);
                setSandboxName("Test Athlete");
                setStep(0);
                setSearchQuery("");
              }}
              onBuildForReal={() => {
                setGeneratedResult(null);
                setSandboxMode(false);
                setStep(0);
              }}
            />
          )}
        </div>
      )}

      {/* Error */}
      {errors.generate && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">
          {errors.generate}
        </div>
      )}

      {/* Navigation */}
      {!generatedResult && !loading && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={prevStep}
            disabled={step === 0}
            className="btn-secondary px-5 py-2.5 disabled:opacity-40"
          >
            Back
          </button>

          {step < STEPS.length - 1 ? (
            <button onClick={nextStep} className="btn-primary px-6 py-2.5">
              Continue
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn-primary px-6 py-2.5 disabled:opacity-60"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
                sandboxMode ? "Preview Program" : "Generate Program"
              )}
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ── Step Components ─────────────────────────────────────────────────────

function UnitToggle({ value, onChange }: { value: "meters" | "feet"; onChange: (v: "meters" | "feet") => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-[var(--card-border)]">
      {(["meters", "feet"] as const).map((unit) => (
        <button key={unit} type="button" onClick={() => onChange(unit)}
          className={`px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
            value === unit ? "bg-primary-500 text-white" : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]"
          }`}
        >{unit === "meters" ? "m" : "ft"}</button>
      ))}
    </div>
  );
}

interface StepProps {
  form: FormState;
  update: (field: keyof FormState, value: FormState[keyof FormState]) => void;
  errors?: Record<string, string>;
}

// ── Step 1: Select Athlete ──────────────────────────────────────────────

function StepSelectAthleteOrTest({
  athletes,
  selectedId,
  onSelect,
  searchQuery,
  setSearchQuery,
  errors = {},
  sandboxMode,
  sandboxName,
  onToggleMode,
  onSandboxNameChange,
}: {
  athletes: AthletePickerItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  errors?: Record<string, string>;
  sandboxMode: boolean;
  sandboxName: string;
  onToggleMode: (sandbox: boolean) => void;
  onSandboxNameChange: (name: string) => void;
}) {
  const filtered = athletes.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = `${a.firstName} ${a.lastName}`.toLowerCase();
    return (
      name.includes(q) || a.events.some((e) => e.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex rounded-xl border border-[var(--card-border)] overflow-hidden">
        <button
          type="button"
          onClick={() => onToggleMode(false)}
          className={`flex-1 py-2.5 text-sm font-medium transition-all ${
            !sandboxMode
              ? "bg-primary-500 text-white"
              : "bg-transparent text-surface-700 dark:text-surface-300 hover:bg-[var(--muted-bg)]"
          }`}
        >
          Real Athlete
        </button>
        <button
          type="button"
          onClick={() => onToggleMode(true)}
          className={`flex-1 py-2.5 text-sm font-medium transition-all ${
            sandboxMode
              ? "bg-primary-500 text-white"
              : "bg-transparent text-surface-700 dark:text-surface-300 hover:bg-[var(--muted-bg)]"
          }`}
        >
          Test Profile
        </button>
      </div>

      {sandboxMode ? (
        /* ── Test Profile Form ─────────────────────────────────────── */
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Sandbox Mode</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Create a hypothetical profile to explore what the Bondarchuk engine produces. No data will be saved.
                </p>
              </div>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="sandboxName">Profile Name</label>
            <input
              id="sandboxName"
              type="text"
              className="input w-full"
              placeholder="e.g. Test Athlete"
              value={sandboxName}
              onChange={(e) => onSandboxNameChange(e.target.value)}
            />
            <p className="text-caption text-surface-700 dark:text-surface-300 mt-1">
              This is just a label for display purposes.
            </p>
          </div>
        </div>
      ) : (
        /* ── Real Athlete Picker ──────────────────────────────────── */
        <>
          <p className="text-body text-surface-700 dark:text-surface-300">
            Select the athlete to build a training program for.
          </p>
          <input
            type="text"
            className="input w-full"
            placeholder="Search by name or event..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-sm text-surface-700 dark:text-surface-300 py-4 text-center">
                {athletes.length === 0
                  ? "No athletes on your roster yet."
                  : "No athletes match your search."}
              </p>
            )}
            {filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelect(a.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                  selectedId === a.id
                    ? "border-primary-500 bg-[rgba(212,168,67,0.08)]"
                    : "border-[var(--card-border)] hover:border-[var(--color-border-strong)]"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[var(--muted-bg)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {a.avatarUrl ? (
                    <img src={a.avatarUrl} alt="" className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                  ) : (
                    <span className="text-sm font-semibold text-surface-700 dark:text-surface-300">
                      {a.firstName?.[0]}
                      {a.lastName?.[0]}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[var(--foreground)] truncate">
                    {a.firstName} {a.lastName}
                  </p>
                  <p className="text-xs text-surface-700 dark:text-surface-300 truncate">
                    {a.events.length > 0 ? a.events.join(", ") : "No events"}
                  </p>
                </div>
                {selectedId === a.id && (
                  <svg className="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {errors.athlete && (
            <p className="text-red-500 text-xs">{errors.athlete}</p>
          )}
        </>
      )}
    </div>
  );
}

// ── Step 2: Event & PR ──────────────────────────────────────────────────

function StepEventPr({ form, update, errors = {} }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="label">Event</label>
        <div className="grid grid-cols-2 gap-3">
          {EVENTS.map((ev) => (
            <button
              key={ev.value}
              type="button"
              onClick={() => {
                update("event", ev.value);
                update("selectedImplements", []);
              }}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                form.event === ev.value
                  ? "border-primary-500 bg-[rgba(212,168,67,0.08)]"
                  : "border-[var(--card-border)] hover:border-[var(--color-border-strong)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: ev.color }}
                />
                <span className="font-medium text-sm text-[var(--foreground)]">
                  {ev.label}
                </span>
              </div>
            </button>
          ))}
        </div>
        {errors.event && (
          <p className="text-red-500 text-xs mt-1">{errors.event}</p>
        )}
      </div>

      <div>
        <label className="label">Gender</label>
        <div className="flex gap-3">
          {GENDERS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => {
                update("gender", g.value);
                update("selectedImplements", []);
              }}
              className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                form.gender === g.value
                  ? "border-primary-500 bg-[rgba(212,168,67,0.08)]"
                  : "border-[var(--card-border)] hover:border-[var(--color-border-strong)]"
              }`}
            >
              <span className="font-medium text-sm text-[var(--foreground)]">
                {g.label}
              </span>
            </button>
          ))}
        </div>
        {errors.gender && (
          <p className="text-red-500 text-xs mt-1">{errors.gender}</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0" htmlFor="pr">Athlete&apos;s Competition PR</label>
          <UnitToggle value={form.distanceUnit} onChange={(v) => update("distanceUnit", v)} />
        </div>
        <input
          id="pr"
          type="number"
          step="0.01"
          min="0"
          className="input w-full"
          placeholder={form.distanceUnit === "meters" ? "e.g. 55.20" : "e.g. 181.10"}
          value={form.competitionPr}
          onChange={(e) => update("competitionPr", e.target.value)}
        />
        {errors.competitionPr && (
          <p className="text-red-500 text-xs mt-1">{errors.competitionPr}</p>
        )}
      </div>
    </div>
  );
}

// ── Step 3: Goal & Schedule ─────────────────────────────────────────────

function StepGoalSchedule({ form, update, errors = {} }: StepProps) {
  return (
    <div className="space-y-6">
      {/* Goal */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0" htmlFor="goalDist">Goal Distance</label>
          <UnitToggle value={form.distanceUnit} onChange={(v) => update("distanceUnit", v)} />
        </div>
        <input
          id="goalDist"
          type="number"
          step="0.01"
          min="0"
          className="input w-full"
          placeholder={form.distanceUnit === "meters" ? "e.g. 65.00" : "e.g. 213.25"}
          value={form.goalDistance}
          onChange={(e) => update("goalDistance", e.target.value)}
        />
        {form.competitionPr && form.goalDistance && (
          <p className="text-caption text-surface-700 dark:text-surface-300 mt-1">
            +
            {(
              parseFloat(form.goalDistance) - parseFloat(form.competitionPr)
            ).toFixed(2)}
            m improvement target
          </p>
        )}
        {errors.goalDistance && (
          <p className="text-red-500 text-xs mt-1">{errors.goalDistance}</p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="targetDate">
          Target Date
        </label>
        <input
          id="targetDate"
          type="date"
          className="input w-full"
          value={form.targetDate}
          onChange={(e) => update("targetDate", e.target.value)}
        />
        {form.targetDate && (
          <p className="text-caption text-surface-700 dark:text-surface-300 mt-1">
            {Math.ceil(
              (new Date(form.targetDate).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24 * 7),
            )}{" "}
            weeks from now
          </p>
        )}
        {errors.targetDate && (
          <p className="text-red-500 text-xs mt-1">{errors.targetDate}</p>
        )}
      </div>

      {/* Schedule */}
      <div className="border-t border-[var(--card-border)] pt-6">
        <h3 className="text-section font-heading text-[var(--foreground)] mb-4">
          Training Schedule
        </h3>

        <div className="space-y-5">
          <div>
            <label className="label">Training Days per Week</label>
            <div className="flex gap-2">
              {[2, 3, 4, 5].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => update("daysPerWeek", d)}
                  className={`flex-1 p-3 rounded-xl border-2 text-center font-semibold transition-all ${
                    form.daysPerWeek === d
                      ? "border-primary-500 bg-[rgba(212,168,67,0.08)] text-primary-600 dark:text-primary-300"
                      : "border-[var(--card-border)] text-surface-700 dark:text-surface-300"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="text-caption text-surface-700 dark:text-surface-300 mt-1">
              {form.daysPerWeek === 2
                ? "Minimum viable — competition prep or recovery focus"
                : form.daysPerWeek === 3
                  ? "Good balance — common for in-season training"
                  : form.daysPerWeek === 4
                    ? "Recommended — optimal development volume"
                    : "High volume — advanced athletes with good recovery"}
            </p>
          </div>

          <div>
            <label className="label">Sessions per Day</label>
            <div className="flex gap-3">
              {[1, 2].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => update("sessionsPerDay", s)}
                  className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                    form.sessionsPerDay === s
                      ? "border-primary-500 bg-[rgba(212,168,67,0.08)]"
                      : "border-[var(--card-border)]"
                  }`}
                >
                  <span className="font-semibold text-[var(--foreground)]">
                    {s}
                  </span>
                  <p className="text-xs text-surface-700 dark:text-surface-300 mt-0.5">
                    {s === 1 ? "Single session" : "AM/PM split"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => update("includeLift", !form.includeLift)}
            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
              form.includeLift
                ? "border-primary-500 bg-[rgba(212,168,67,0.08)]"
                : "border-[var(--card-border)]"
            }`}
          >
            <div>
              <span className="font-medium text-sm text-[var(--foreground)]">
                Include Strength Training
              </span>
              <p className="text-xs text-surface-700 dark:text-surface-300">
                Prescribed lifts based on PRs and training phase
              </p>
            </div>
            <div
              className={`w-10 h-6 rounded-full transition-colors relative ${
                form.includeLift
                  ? "bg-primary-500"
                  : "bg-[var(--color-border-strong)]"
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  form.includeLift ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Equipment ───────────────────────────────────────────────────

function StepEquipment({
  form,
  update,
  errors = {},
  options,
}: StepProps & { options: ImplementOption[] }) {
  const toggle = (wKg: number) => {
    const current = form.selectedImplements;
    if (current.includes(wKg)) {
      update(
        "selectedImplements",
        current.filter((w) => w !== wKg),
      );
    } else {
      update("selectedImplements", [...current, wKg]);
    }
  };

  const toggleGymItem = (key: string) => {
    update("gymEquipment", {
      ...form.gymEquipment,
      [key]: !form.gymEquipment[key],
    });
  };

  const facilities = [
    {
      key: "hasCage" as const,
      label: "Throwing Cage",
      desc: "Enclosed cage for disc/hammer",
    },
    {
      key: "hasRing" as const,
      label: "Throwing Ring",
      desc: "Concrete circle/ring",
    },
    {
      key: "hasFieldAccess" as const,
      label: "Field Access",
      desc: "Open field for throwing",
    },
    {
      key: "hasGym" as const,
      label: "Weight Room",
      desc: "Gym for strength training",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Implements */}
      <div>
        <h3 className="text-section font-heading text-[var(--foreground)] mb-2">
          Available Implements
        </h3>
        <p className="text-body text-surface-700 dark:text-surface-300 mb-3">
          Select all implements the athlete has access to.
        </p>

        {!form.event || !form.gender ? (
          <p className="text-sm text-surface-700 dark:text-surface-300">
            Please select event and gender first (Step 2).
          </p>
        ) : (
          <div className="space-y-2">
            {options.map((impl) => {
              const selected =
                form.selectedImplements.includes(impl.weightKg) ||
                impl.isCompetition;
              return (
                <button
                  key={impl.weightKg}
                  type="button"
                  onClick={() => {
                    if (!impl.isCompetition) toggle(impl.weightKg);
                  }}
                  disabled={impl.isCompetition}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                    selected
                      ? "border-primary-500 bg-[rgba(212,168,67,0.08)]"
                      : "border-[var(--card-border)] hover:border-[var(--color-border-strong)]"
                  } ${impl.isCompetition ? "opacity-80" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        selected
                          ? "bg-primary-500 border-primary-500"
                          : "border-[var(--color-border-strong)]"
                      }`}
                    >
                      {selected && (
                        <svg
                          className="w-3 h-3 text-black"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="font-medium text-sm text-[var(--foreground)]">
                      {impl.label}
                    </span>
                  </div>
                  {impl.isCompetition && (
                    <span className="text-xs bg-[rgba(212,168,67,0.12)] dark:bg-[rgba(212,168,67,0.15)] text-primary-600 dark:text-primary-300 px-2 py-0.5 rounded-full">
                      Required
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {errors.implements && (
          <p className="text-red-500 text-xs mt-1">{errors.implements}</p>
        )}
      </div>

      {/* Facilities */}
      <div className="border-t border-[var(--card-border)] pt-6">
        <h3 className="text-section font-heading text-[var(--foreground)] mb-3">
          Facilities
        </h3>
        <div className="space-y-3">
          {facilities.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => update(f.key, !form[f.key])}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                form[f.key]
                  ? "border-primary-500 bg-[rgba(212,168,67,0.08)]"
                  : "border-[var(--card-border)]"
              }`}
            >
              <div>
                <span className="font-medium text-sm text-[var(--foreground)]">
                  {f.label}
                </span>
                <p className="text-xs text-surface-700 dark:text-surface-300">{f.desc}</p>
              </div>
              <div
                className={`w-10 h-6 rounded-full transition-colors relative ${
                  form[f.key]
                    ? "bg-primary-500"
                    : "bg-[var(--color-border-strong)]"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    form[f.key] ? "translate-x-[18px]" : "translate-x-0.5"
                  }`}
                />
              </div>
            </button>
          ))}
        </div>

        {form.hasGym && (
          <div className="mt-4">
            <p className="label mb-2">Gym Equipment Available</p>
            <div className="grid grid-cols-2 gap-2">
              {GYM_EQUIPMENT_OPTIONS.map((eq) => (
                <button
                  key={eq.key}
                  type="button"
                  onClick={() => toggleGymItem(eq.key)}
                  className={`p-2.5 rounded-lg border text-left text-sm transition-all ${
                    form.gymEquipment[eq.key]
                      ? "border-primary-500 bg-[rgba(212,168,67,0.08)] font-medium"
                      : "border-[var(--card-border)] text-surface-700 dark:text-surface-300"
                  }`}
                >
                  {eq.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 5: Lifting & Experience ────────────────────────────────────────

function StepLiftingExperience({ form, update, errors = {} }: StepProps) {
  const lifts = [
    { key: "squatKg" as const, label: "Back Squat", placeholder: "kg" },
    { key: "benchKg" as const, label: "Bench Press", placeholder: "kg" },
    { key: "cleanKg" as const, label: "Power Clean", placeholder: "kg" },
    { key: "snatchKg" as const, label: "Power Snatch", placeholder: "kg" },
    { key: "ohpKg" as const, label: "Overhead Press", placeholder: "kg" },
    { key: "deadliftKg" as const, label: "Deadlift", placeholder: "kg" },
  ];

  return (
    <div className="space-y-6">
      {/* Lifting PRs */}
      <div>
        <h3 className="text-section font-heading text-[var(--foreground)] mb-2">
          Lifting PRs
        </h3>
        <p className="text-body text-surface-700 dark:text-surface-300 mb-4">
          Enter the athlete&apos;s 1RM or best recent working weight. Leave blank if
          unknown.
        </p>

        <div className="mb-4">
          <label className="label" htmlFor="bodyweight">
            Body Weight (kg) *
          </label>
          <input
            id="bodyweight"
            type="number"
            step="0.1"
            min="0"
            className="input w-full"
            placeholder="e.g. 90"
            value={form.bodyWeightKg}
            onChange={(e) => update("bodyWeightKg", e.target.value)}
          />
          {errors.bodyWeightKg && (
            <p className="text-red-500 text-xs mt-1">{errors.bodyWeightKg}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {lifts.map((lift) => (
            <div key={lift.key}>
              <label className="label text-xs" htmlFor={lift.key}>
                {lift.label}
              </label>
              <input
                id={lift.key}
                type="number"
                step="0.5"
                min="0"
                className="input w-full"
                placeholder={lift.placeholder}
                value={form[lift.key]}
                onChange={(e) => update(lift.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Experience */}
      <div className="border-t border-[var(--card-border)] pt-6">
        <h3 className="text-section font-heading text-[var(--foreground)] mb-4">
          Experience
        </h3>

        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="years">
              Years of Throwing Experience *
            </label>
            <input
              id="years"
              type="number"
              step="0.5"
              min="0"
              className="input w-full"
              placeholder="e.g. 3"
              value={form.yearsThrowing}
              onChange={(e) => update("yearsThrowing", e.target.value)}
            />
            {errors.yearsThrowing && (
              <p className="text-red-500 text-xs mt-1">
                {errors.yearsThrowing}
              </p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="vol">
              Current Weekly Throw Volume (approx)
            </label>
            <input
              id="vol"
              type="number"
              min="0"
              className="input w-full"
              placeholder="e.g. 120 throws/week"
              value={form.currentWeeklyVolume}
              onChange={(e) => update("currentWeeklyVolume", e.target.value)}
            />
            <p className="text-caption text-surface-700 dark:text-surface-300 mt-1">
              Helps calibrate starting volume to avoid injury
            </p>
          </div>

          <div>
            <label className="label" htmlFor="phase">
              Current Training Phase (optional)
            </label>
            <select
              id="phase"
              className="input w-full"
              value={form.currentPhase}
              onChange={(e) => update("currentPhase", e.target.value)}
            >
              <option value="">Not sure / Off-season</option>
              {PHASES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Typing Info */}
      {form.hasTyping ? (
        <div className="p-4 bg-[rgba(212,168,67,0.08)] border border-[rgba(212,168,67,0.2)] rounded-xl">
          <p className="text-sm font-medium text-primary-600 dark:text-primary-300">
            Adaptation Profile Detected
          </p>
          <p className="text-xs text-surface-700 dark:text-surface-300 mt-1">
            Group {form.adaptationGroup} · ~{form.sessionsToForm} sessions to form ·{" "}
            {form.recommendedMethod} method
          </p>
        </div>
      ) : (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            No Adaptation Profile Found
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            The program will use moderate adaptation defaults. Complete the
            Typing Quiz for this athlete to personalize their adaptation
            profile.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Step 6: Review ──────────────────────────────────────────────────────

function StepReview({
  form,
  athleteName,
  implementOptions,
  isSandbox = false,
}: {
  form: FormState;
  athleteName: string;
  implementOptions: ImplementOption[];
  isSandbox?: boolean;
}) {
  const eventLabel =
    EVENTS.find((e) => e.value === form.event)?.label ?? form.event;
  const selectedImpls = implementOptions.filter(
    (i) => form.selectedImplements.includes(i.weightKg) || i.isCompetition,
  );

  return (
    <div className="space-y-4">
      <h3 className="text-section font-heading text-[var(--foreground)]">
        Review Program Setup
      </h3>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        <ReviewRow label="Athlete" value={athleteName} />
        <ReviewRow label="Event" value={`${eventLabel} (${form.gender})`} />
        <ReviewRow label="Competition PR" value={`${form.competitionPr}m`} />
        <ReviewRow
          label="Goal"
          value={`${form.goalDistance}m by ${form.targetDate}`}
        />
        <ReviewRow
          label="Implements"
          value={selectedImpls.map((i) => i.label).join(", ")}
        />
        <ReviewRow
          label="Schedule"
          value={`${form.daysPerWeek} days/week, ${form.sessionsPerDay} session${form.sessionsPerDay > 1 ? "s" : ""}/day${form.includeLift ? " + lifting" : ""}`}
        />
        <ReviewRow
          label="Experience"
          value={`${form.yearsThrowing} year${parseFloat(form.yearsThrowing) !== 1 ? "s" : ""}${form.currentWeeklyVolume ? `, ~${form.currentWeeklyVolume} throws/week` : ""}`}
        />
        <ReviewRow label="Body Weight" value={`${form.bodyWeightKg}kg`} />
        {form.hasTyping && (
          <ReviewRow
            label="Adaptation"
            value={`Group ${form.adaptationGroup} — ${form.recommendedMethod}`}
          />
        )}
      </div>

      <div className="p-4 bg-[rgba(212,168,67,0.08)] border border-[rgba(212,168,67,0.2)] rounded-xl mt-4">
        <p className="text-sm text-primary-600 dark:text-primary-300">
          {isSandbox
            ? "This is a sandbox preview \u2014 the engine output will be shown but nothing will be saved."
            : "This program will be generated using Bondarchuk periodization methodology, customized for the athlete\u2019s event, level, and adaptation profile."}
        </p>
      </div>
    </div>
  );
}

// ── Program Summary Card ────────────────────────────────────────────────

function ProgramSummaryCard({
  result,
  athleteName,
  onReset,
}: {
  result: { programId: string; totalWeeks: number; summary: ProgramSummary };
  athleteName: string;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-3 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-green-600 dark:text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-section font-heading text-[var(--foreground)]">
          Program Generated!
        </h3>
        <p className="text-body text-surface-700 dark:text-surface-300 mt-1">
          Training program for {athleteName} is ready
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 bg-[var(--muted-bg)] rounded-xl">
          <p className="text-2xl font-bold font-heading text-primary-500">
            {result.totalWeeks}
          </p>
          <p className="text-xs text-surface-700 dark:text-surface-300">Weeks</p>
        </div>
        <div className="text-center p-3 bg-[var(--muted-bg)] rounded-xl">
          <p className="text-2xl font-bold font-heading text-primary-500">
            {result.summary.totalPhases}
          </p>
          <p className="text-xs text-surface-700 dark:text-surface-300">Phases</p>
        </div>
        <div className="text-center p-3 bg-[var(--muted-bg)] rounded-xl">
          <p className="text-2xl font-bold font-heading text-primary-500">
            {result.summary.totalSessions}
          </p>
          <p className="text-xs text-surface-700 dark:text-surface-300">Sessions</p>
        </div>
      </div>

      {/* Phase Timeline */}
      <div>
        <p className="label mb-2">Phase Breakdown</p>
        <div className="space-y-2">
          {result.summary.phaseBreakdown.map((pb, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--muted-bg)]"
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: PHASE_COLORS[pb.phase] || "#888",
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {pb.phase}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {pb.weeks}w
                </p>
                <p className="text-xs text-surface-700 dark:text-surface-300">
                  ~{pb.throwsPerWeek} throws/wk
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Estimated Total Throws */}
      <div className="text-center p-4 bg-[rgba(212,168,67,0.08)] border border-[rgba(212,168,67,0.2)] rounded-xl">
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Estimated Total Throws
        </p>
        <p className="text-3xl font-bold font-heading text-primary-500">
          {result.summary.estimatedTotalThrows.toLocaleString()}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Link
          href={`/coach/my-program?programId=${result.programId}`}
          className="btn-primary w-full py-3 text-center"
        >
          View Full Program
        </Link>
        <button
          onClick={onReset}
          className="btn-secondary w-full py-3"
        >
          Build Another Program
        </button>
      </div>
    </div>
  );
}

// ── Sandbox Preview Card ─────────────────────────────────────────────────

function SandboxPreviewCard({
  generated,
  profileName,
  form,
  implementOptions: _implementOptions,
  onReset,
  onBuildForReal,
}: {
  generated: SandboxGenerated;
  profileName: string;
  form: FormState;
  implementOptions: ImplementOption[];
  onReset: () => void;
  onBuildForReal: () => void;
}) {
  void _implementOptions; // available for future use
  const [expandedPhase, setExpandedPhase] = useState(0);
  const [expandedSession, setExpandedSession] = useState(0);

  const eventLabel = EVENTS.find((e) => e.value === form.event)?.label ?? form.event;
  const week1 = generated.phases[0]?.weeks?.[0];
  const sessions = week1?.sessions ?? [];

  return (
    <div className="space-y-6">
      {/* Sandbox Banner */}
      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2">
        <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
          Sandbox Preview for &quot;{profileName}&quot; &mdash; {eventLabel} ({form.gender})
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2">
        <div className="text-center p-3 bg-[var(--muted-bg)] rounded-xl">
          <p className="text-xl font-bold font-heading text-primary-500">{generated.totalWeeks}</p>
          <p className="text-[10px] text-surface-700 dark:text-surface-300">Weeks</p>
        </div>
        <div className="text-center p-3 bg-[var(--muted-bg)] rounded-xl">
          <p className="text-xl font-bold font-heading text-primary-500">{generated.summary.totalPhases}</p>
          <p className="text-[10px] text-surface-700 dark:text-surface-300">Phases</p>
        </div>
        <div className="text-center p-3 bg-[var(--muted-bg)] rounded-xl">
          <p className="text-xl font-bold font-heading text-primary-500">{generated.summary.totalSessions}</p>
          <p className="text-[10px] text-surface-700 dark:text-surface-300">Sessions</p>
        </div>
        <div className="text-center p-3 bg-[var(--muted-bg)] rounded-xl">
          <p className="text-xl font-bold font-heading text-primary-500">{generated.summary.estimatedTotalThrows.toLocaleString()}</p>
          <p className="text-[10px] text-surface-700 dark:text-surface-300">Total Throws</p>
        </div>
      </div>

      {/* ── Phase Details ────────────────────────────────────────────── */}
      <div>
        <p className="label mb-2">Phase Breakdown</p>
        <div className="space-y-2">
          {generated.phases.map((phase: any, pi: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            const isExpanded = expandedPhase === pi;
            const color = PHASE_COLORS[phase.phase] || "#888";
            return (
              <div key={pi} className="border border-[var(--card-border)] rounded-xl overflow-hidden">
                {/* Phase header (clickable) */}
                <button
                  type="button"
                  onClick={() => setExpandedPhase(isExpanded ? -1 : pi)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-[var(--muted-bg)] transition-colors"
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)]">{phase.phase}</p>
                    <p className="text-xs text-surface-700 dark:text-surface-300">
                      Weeks {phase.startWeek}-{phase.endWeek} &middot; {phase.durationWeeks}w &middot; ~{phase.throwsPerWeekTarget} throws/wk
                    </p>
                  </div>
                  <svg className={`w-4 h-4 text-surface-700 dark:text-surface-300 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Phase expanded content */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3 border-t border-[var(--card-border)]">
                    {/* Category Ratios (CE/SD/SP/GP) */}
                    <div className="pt-3">
                      <p className="text-[11px] font-medium text-surface-700 dark:text-surface-300 mb-1.5">Exercise Categories</p>
                      <div className="flex rounded-lg overflow-hidden h-6 text-[10px] font-semibold">
                        {phase.cePercent > 0 && (
                          <div className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 flex items-center justify-center" style={{ width: `${phase.cePercent}%` }}>
                            CE {phase.cePercent}%
                          </div>
                        )}
                        {phase.sdPercent > 0 && (
                          <div className="bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 flex items-center justify-center" style={{ width: `${phase.sdPercent}%` }}>
                            SD {phase.sdPercent}%
                          </div>
                        )}
                        {phase.spPercent > 0 && (
                          <div className="bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 flex items-center justify-center" style={{ width: `${phase.spPercent}%` }}>
                            SP {phase.spPercent}%
                          </div>
                        )}
                        {phase.gpPercent > 0 && (
                          <div className="bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100 flex items-center justify-center" style={{ width: `${phase.gpPercent}%` }}>
                            GP {phase.gpPercent}%
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Implement Distribution */}
                    <div>
                      <p className="text-[11px] font-medium text-surface-700 dark:text-surface-300 mb-1.5">Implement Distribution</p>
                      <div className="flex rounded-lg overflow-hidden h-6 text-[10px] font-semibold">
                        {phase.heavyPercent > 0 && (
                          <div className="bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100 flex items-center justify-center" style={{ width: `${phase.heavyPercent}%` }}>
                            Heavy {phase.heavyPercent}%
                          </div>
                        )}
                        {phase.compPercent > 0 && (
                          <div className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 flex items-center justify-center" style={{ width: `${phase.compPercent}%` }}>
                            Comp {phase.compPercent}%
                          </div>
                        )}
                        {phase.lightPercent > 0 && (
                          <div className="bg-sky-200 dark:bg-sky-800 text-sky-900 dark:text-sky-100 flex items-center justify-center" style={{ width: `${phase.lightPercent}%` }}>
                            Light {phase.lightPercent}%
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Exercise Complex */}
                    {phase.exerciseComplex?.length > 0 && (
                      <div>
                        <p className="text-[11px] font-medium text-surface-700 dark:text-surface-300 mb-1.5">Exercise Complex</p>
                        <div className="space-y-1">
                          {phase.exerciseComplex.map((ex: any, ei: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                            const cls = CLASSIFICATION_COLORS[ex.classification] || { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300" };
                            return (
                              <div key={ei} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-[var(--muted-bg)] text-xs">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls.bg} ${cls.text}`}>
                                  {ex.classification}
                                </span>
                                <span className="font-medium text-[var(--foreground)] flex-1">{ex.name}</span>
                                {ex.implementKg && (
                                  <span className="text-surface-700 dark:text-surface-300">{ex.implementKg}kg</span>
                                )}
                                <span className="text-surface-700 dark:text-surface-300">
                                  {ex.setsMin}-{ex.setsMax}s &times; {ex.repsMin}-{ex.repsMax}r
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Week 1 Sessions ──────────────────────────────────────────── */}
      {sessions.length > 0 && (
        <div>
          <p className="label mb-2">Week 1 Sessions</p>
          <div className="space-y-2">
            {sessions.map((session: any, si: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const isExpanded = expandedSession === si;
              return (
                <div key={si} className="border border-[var(--card-border)] rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedSession(isExpanded ? -1 : si)}
                    className="w-full flex items-center gap-2 p-3 text-left hover:bg-[var(--muted-bg)] transition-colors"
                  >
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {DAY_SHORT[session.dayOfWeek] || `Day ${session.dayOfWeek}`}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300">
                      {session.dayType}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                      {session.sessionType.replace(/_/g, " ")}
                    </span>
                    <span className="flex-1 text-xs text-surface-700 dark:text-surface-300 truncate text-right">
                      {session.focusLabel}
                    </span>
                    <svg className={`w-4 h-4 text-surface-700 dark:text-surface-300 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3 border-t border-[var(--card-border)]">
                      <p className="text-[11px] text-surface-700 dark:text-surface-300 pt-2">
                        ~{session.totalThrowsTarget} throws &middot; ~{session.estimatedDuration} min
                      </p>

                      {/* Throws Block */}
                      {session.throws?.length > 0 && (
                        <div>
                          <p className="text-[11px] font-medium text-surface-700 dark:text-surface-300 mb-1.5">Throws</p>
                          <div className="space-y-1">
                            {session.throws.map((t: any, ti: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                              const cls = CLASSIFICATION_COLORS[t.category] || { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300" };
                              return (
                                <div key={ti} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-[var(--muted-bg)] text-xs">
                                  <span className="font-bold text-[var(--foreground)] min-w-[48px]">{t.implement}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls.bg} ${cls.text}`}>{t.category}</span>
                                  <span className="text-surface-700 dark:text-surface-300">{t.drillType?.replace(/_/g, " ")}</span>
                                  <span className="ml-auto font-medium text-[var(--foreground)]">{t.sets}&times;{t.repsPerSet}</span>
                                  <span className="text-surface-700 dark:text-surface-300">{t.restSeconds}s rest</span>
                                </div>
                              );
                            })}
                          </div>
                          {/* Implement order validation */}
                          <ImplementOrderCheck throws={session.throws} />
                        </div>
                      )}

                      {/* Strength Block */}
                      {session.strength?.length > 0 && (
                        <div>
                          <p className="text-[11px] font-medium text-surface-700 dark:text-surface-300 mb-1.5">Strength</p>
                          <div className="space-y-1">
                            {session.strength.map((s: any, si2: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                              const cls = CLASSIFICATION_COLORS[s.classification] || { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300" };
                              return (
                                <div key={si2} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-[var(--muted-bg)] text-xs">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls.bg} ${cls.text}`}>{s.classification}</span>
                                  <span className="font-medium text-[var(--foreground)] flex-1">{s.exerciseName}</span>
                                  <span className="text-[var(--foreground)]">{s.sets}&times;{s.reps}</span>
                                  {s.intensityPercent && <span className="text-surface-700 dark:text-surface-300">@{s.intensityPercent}%</span>}
                                  {s.loadKg && <span className="text-surface-700 dark:text-surface-300">{s.loadKg}kg</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Warmup */}
                      {session.warmup?.length > 0 && (
                        <div>
                          <p className="text-[11px] font-medium text-surface-700 dark:text-surface-300 mb-1.5">Warmup</p>
                          <div className="flex flex-wrap gap-1.5">
                            {session.warmup.map((w: any, wi: number) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                              <span key={wi} className="text-[11px] px-2 py-1 rounded-lg bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300">
                                {w.name}{w.duration ? ` (${w.duration}min)` : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 pt-2">
        <button onClick={onBuildForReal} className="btn-primary w-full py-3">
          Generate for Real Athlete
        </button>
        <button onClick={onReset} className="btn-secondary w-full py-3">
          Build Another Test Profile
        </button>
      </div>
    </div>
  );
}

// ── Implement Order Check ────────────────────────────────────────────────

function ImplementOrderCheck({ throws }: { throws: Array<{ implementKg: number; implement: string }> }) {
  if (!throws || throws.length < 2) return null;

  // Check if implements are in descending weight order (Bondarchuk rule)
  let isDescending = true;
  for (let i = 1; i < throws.length; i++) {
    if (throws[i].implementKg > throws[i - 1].implementKg) {
      isDescending = false;
      break;
    }
  }

  const weights = throws.map((t) => t.implement).join(" \u2192 ");

  return (
    <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] ${isDescending ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
      {isDescending ? (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      )}
      <span className="font-medium">
        {isDescending ? "Correct descending order" : "Warning: ascending order detected"}
      </span>
      <span className="text-surface-700 dark:text-surface-300">({weights})</span>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2.5">
      <span className="text-sm text-surface-700 dark:text-surface-300">{label}</span>
      <span className="text-sm font-medium text-[var(--foreground)] text-right max-w-[60%]">
        {value}
      </span>
    </div>
  );
}
