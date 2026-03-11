"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── Constants ──────────────────────────────────────────────────────────
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

type ThrowEvent = "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";
type Gender = "MALE" | "FEMALE";

interface ImplementOption {
  weight: string;
  weightKg: number;
  isCompetition: boolean;
  label: string;
}

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
  SHOT_PUT: "shot", DISCUS: "disc", HAMMER: "hammer", JAVELIN: "jav",
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

const MOBILITY_REGIONS = [
  "Shoulders", "Upper Back", "Lower Back", "Hips", "Knees", "Ankles", "Wrists",
];

const STEPS = [
  "Event & PR",
  "Short-Term Goal",
  "Long-Term Goal",
  "Competitions",
  "Implements",
  "Facilities",
  "Lifting PRs",
  "Mobility",
  "Training History",
  "Typing",
  "Review",
];

// ── Form State ──────────────────────────────────────────────────────

interface Competition {
  name: string;
  date: string;
  event: string;
  priority: "A" | "B" | "C";
}

interface MobilityRegion {
  area: string;
  severity: "none" | "mild" | "moderate" | "severe";
  notes: string;
}

interface FormState {
  event: ThrowEvent | "";
  gender: Gender | "";
  competitionPr: string;
  shortTermGoal: string;
  goalDistance: string;
  targetDate: string;
  longTermGoal: string;
  longTermDistance: string;
  longTermDate: string;
  competitions: Competition[];
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
  rdlKg: string;
  bodyWeightKg: string;
  mobilityRegions: MobilityRegion[];
  yearsThrowing: string;
  currentWeeklyVolume: string;
  daysPerWeek: number;
  sessionsPerDay: number;
  includeLift: boolean;
  useExistingTyping: boolean;
  hasTyping: boolean;
  adaptationGroup: number;
  sessionsToForm: number;
  recommendedMethod: string;
  transferType: string;
}

const DEFAULT_FORM: FormState = {
  event: "", gender: "", competitionPr: "",
  shortTermGoal: "", goalDistance: "", targetDate: "",
  longTermGoal: "", longTermDistance: "", longTermDate: "",
  competitions: [{ name: "", date: "", event: "", priority: "A" }],
  selectedImplements: [],
  hasCage: true, hasRing: true, hasFieldAccess: true, hasGym: true,
  gymEquipment: { barbell: true, squatRack: true, platform: false, dumbbells: true, cables: false, medBalls: false, boxes: false, bands: false },
  squatKg: "", benchKg: "", cleanKg: "", snatchKg: "", ohpKg: "", deadliftKg: "", rdlKg: "", bodyWeightKg: "",
  mobilityRegions: MOBILITY_REGIONS.map((area) => ({ area, severity: "none" as const, notes: "" })),
  yearsThrowing: "", currentWeeklyVolume: "",
  daysPerWeek: 4, sessionsPerDay: 1, includeLift: true,
  useExistingTyping: true, hasTyping: false,
  adaptationGroup: 2, sessionsToForm: 25, recommendedMethod: "complex", transferType: "",
};

// ── Main Component ──────────────────────────────────────────────────

export default function OnboardingWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false); // Ref guard for double-submit
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch prefill data
  useEffect(() => {
    async function fetchPrefill() {
      try {
        const res = await fetch("/api/coach/my-program/onboard");
        if (res.ok) {
          const { data } = await res.json();
          if (data) {
            setForm((prev) => ({
              ...prev,
              event: data.preferredEvent || "",
              hasTyping: data.hasTyping || false,
              adaptationGroup: data.typing?.adaptationGroup ?? 2,
              sessionsToForm: data.typing?.sessionsToForm ?? 25,
              recommendedMethod: data.typing?.recommendedMethod ?? "complex",
              transferType: data.typing?.transferType ?? "",
              ...(data.liftingPrs ? {
                squatKg: data.liftingPrs.squatKg?.toString() ?? "",
                benchKg: data.liftingPrs.benchKg?.toString() ?? "",
                cleanKg: data.liftingPrs.cleanKg?.toString() ?? "",
                snatchKg: data.liftingPrs.snatchKg?.toString() ?? "",
                ohpKg: data.liftingPrs.ohpKg?.toString() ?? "",
                rdlKg: data.liftingPrs.rdlKg?.toString() ?? "",
                bodyWeightKg: data.liftingPrs.bodyWeightKg?.toString() ?? "",
              } : {}),
              ...(data.competitionPrs && data.preferredEvent && data.competitionPrs[data.preferredEvent] ? {
                competitionPr: data.competitionPrs[data.preferredEvent].toString(),
              } : {}),
              ...(data.currentVolume ? { currentWeeklyVolume: data.currentVolume.toString() } : {}),
            }));
          }
        }
      } catch { /* silently fail */ }
      finally { setLoading(false); }
    }
    fetchPrefill();
  }, []);

  const update = useCallback(
    (field: keyof FormState, value: FormState[keyof FormState]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    }, [],
  );

  // ── Step Validation ──────────────────────────────────────────────

  function validateStep(s: number): boolean {
    const errs: Record<string, string> = {};
    if (s === 0) {
      if (!form.event) errs.event = "Select an event";
      if (!form.gender) errs.gender = "Select gender";
      if (!form.competitionPr || parseFloat(form.competitionPr) <= 0) errs.competitionPr = "Enter your competition PR";
    }
    if (s === 1) {
      if (!form.goalDistance || parseFloat(form.goalDistance) <= 0) errs.goalDistance = "Enter a goal distance";
      if (!form.targetDate) errs.targetDate = "Select a target date";
      if (form.targetDate && new Date(form.targetDate) < new Date()) errs.targetDate = "Date must be in the future";
    }
    // Steps 2-3 optional
    if (s === 4) {
      if (form.selectedImplements.length === 0) errs.implements = "Select at least one implement";
    }
    if (s === 8) {
      if (!form.yearsThrowing || parseFloat(form.yearsThrowing) < 0) errs.yearsThrowing = "Enter years of throwing experience";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function nextStep() { if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1)); }
  function prevStep() { setStep((s) => Math.max(s - 1, 0)); }

  // ── Generate Program ──────────────────────────────────────────────

  async function handleGenerate() {
    // Guard against double-submit (ref is synchronous, avoids race with setState)
    if (generatingRef.current) return;

    // Validate all required steps before submitting
    for (let s = 0; s <= 8; s++) {
      if (!validateStep(s)) {
        setStep(s);
        return;
      }
    }
    generatingRef.current = true;
    setGenerating(true);
    try {
      const ev = form.event as ThrowEvent;
      const gen = form.gender as Gender;
      const implType = IMPLEMENT_TYPE_MAP[ev];

      const payload = {
        event: ev,
        gender: gen,
        competitionPr: parseFloat(form.competitionPr),
        goalDistance: parseFloat(form.goalDistance),
        targetDate: form.targetDate,
        shortTermGoal: form.shortTermGoal || undefined,
        longTermGoal: form.longTermGoal || undefined,
        longTermDistance: form.longTermDistance ? parseFloat(form.longTermDistance) : undefined,
        longTermDate: form.longTermDate || undefined,
        competitions: form.competitions.filter((c) => c.name && c.date),
        mobilityRegions: form.mobilityRegions.filter((r) => r.severity !== "none"),
        implements: form.selectedImplements.map((wKg) => ({ weightKg: wKg, type: implType })),
        facilities: {
          hasCage: form.hasCage, hasRing: form.hasRing,
          hasFieldAccess: form.hasFieldAccess, hasGym: form.hasGym,
          gymEquipment: form.gymEquipment,
        },
        liftingPrs: {
          squatKg: form.squatKg ? parseFloat(form.squatKg) : undefined,
          benchKg: form.benchKg ? parseFloat(form.benchKg) : undefined,
          cleanKg: form.cleanKg ? parseFloat(form.cleanKg) : undefined,
          snatchKg: form.snatchKg ? parseFloat(form.snatchKg) : undefined,
          ohpKg: form.ohpKg ? parseFloat(form.ohpKg) : undefined,
          deadliftKg: form.deadliftKg ? parseFloat(form.deadliftKg) : undefined,
          bodyWeightKg: form.bodyWeightKg ? parseFloat(form.bodyWeightKg) : 80,
        },
        schedule: { daysPerWeek: form.daysPerWeek, sessionsPerDay: form.sessionsPerDay, includeLift: form.includeLift },
        experience: {
          yearsThrowing: parseFloat(form.yearsThrowing),
          currentWeeklyVolume: form.currentWeeklyVolume ? parseInt(form.currentWeeklyVolume) : undefined,
        },
        typing: form.hasTyping ? {
          adaptationGroup: form.adaptationGroup,
          sessionsToForm: form.sessionsToForm,
          recommendedMethod: form.recommendedMethod,
          transferType: form.transferType || undefined,
        } : undefined,
      };

      const res = await fetch("/api/coach/my-program/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = "Failed to generate program";
        try {
          const err = await res.json();
          if (err?.error) message = err.error;
          if (err?.errors) message += ": " + (Array.isArray(err.errors) ? err.errors.join(", ") : String(err.errors));
        } catch { /* non-JSON error response */ }
        setErrors({ generate: message });
        generatingRef.current = false;
        setGenerating(false);
        return;
      }

      const { data } = await res.json();
      router.push(`/coach/my-program?generated=${data.programId}`);
    } catch {
      setErrors({ generate: "Something went wrong. Please try again." });
      generatingRef.current = false;
      setGenerating(false);
    }
  }

  const implementOptions: ImplementOption[] =
    form.event && form.gender
      ? IMPLEMENTS_MAP[form.event as ThrowEvent]?.[form.gender as Gender] ?? []
      : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-title font-heading text-[var(--foreground)]">Create Training Program</h1>
        <p className="text-body text-muted mt-1">Set up your Bondarchuk-based periodized training plan</p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2 overflow-x-auto scrollbar-none gap-1">
          {STEPS.map((label, i) => (
            <button
              key={label}
              onClick={() => { if (i < step) setStep(i); }}
              aria-label={`Step ${i + 1}: ${label}${i < step ? " (completed)" : i === step ? " (current)" : ""}`}
              aria-current={i === step ? "step" : undefined}
              className={`flex items-center justify-center w-7 h-7 min-w-[44px] min-h-[44px] rounded-full text-[10px] font-semibold transition-all shrink-0 ${
                i === step
                  ? "bg-[var(--color-gold)] text-black shadow-md"
                  : i < step
                  ? "bg-primary-500/20 text-primary-600 cursor-pointer"
                  : "bg-[var(--muted-bg)] text-muted"
              }`}
            >
              {i < step ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </button>
          ))}
        </div>
        <div
          className="h-1.5 bg-[var(--muted-bg)] rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
        >
          <div
            className="h-full bg-[var(--color-gold)] rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <p className="text-caption text-muted mt-2 text-center">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
      </div>

      {/* Step Content */}
      <div className="card p-5">
        {step === 0 && <StepEventPr form={form} update={update} errors={errors} />}
        {step === 1 && <StepShortTermGoal form={form} update={update} errors={errors} />}
        {step === 2 && <StepLongTermGoal form={form} update={update} />}
        {step === 3 && <StepCompetitions form={form} update={update} />}
        {step === 4 && <StepImplements form={form} update={update} errors={errors} options={implementOptions} />}
        {step === 5 && <StepFacilities form={form} update={update} />}
        {step === 6 && <StepLifting form={form} update={update} />}
        {step === 7 && <StepMobility form={form} update={update} />}
        {step === 8 && <StepTrainingHistory form={form} update={update} errors={errors} />}
        {step === 9 && <StepTyping form={form} update={update} />}
        {step === 10 && <StepReview form={form} implementOptions={implementOptions} />}
      </div>

      <div aria-live="assertive" aria-atomic="true">
        {errors.generate && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm" role="alert">
            {errors.generate}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        {step === 0 ? (
          <Link href="/coach/my-program" className="btn-secondary px-5 py-2.5">Cancel</Link>
        ) : (
          <button onClick={prevStep} className="btn-secondary px-5 py-2.5">Back</button>
        )}
        {step < STEPS.length - 1 ? (
          <button onClick={nextStep} className="btn-primary px-6 py-2.5">Continue</button>
        ) : (
          <button onClick={handleGenerate} disabled={generating} className="btn-primary px-6 py-2.5 disabled:opacity-60">
            {generating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Generating...
              </span>
            ) : "Generate Program"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Step Components ─────────────────────────────────────────────────

interface StepProps {
  form: FormState;
  update: (field: keyof FormState, value: FormState[keyof FormState]) => void;
  errors?: Record<string, string>;
}

function StepEventPr({ form, update, errors = {} }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <span className="label" id="event-label">Event</span>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-labelledby="event-label">
          {EVENTS.map((ev) => (
            <button key={ev.value} type="button" role="radio" aria-checked={form.event === ev.value}
              onClick={() => { update("event", ev.value); update("selectedImplements", []); }}
              className={`p-3 rounded-xl border-2 text-left transition-all ${form.event === ev.value ? "border-[var(--color-gold)] bg-primary-500/[0.08]" : "border-[var(--card-border)] hover:border-[var(--foreground)]/20"}`}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ev.color }} />
                <span className="font-medium text-sm text-[var(--foreground)]">{ev.label}</span>
              </div>
            </button>
          ))}
        </div>
        {errors.event && <p className="text-red-500 text-xs mt-1">{errors.event}</p>}
      </div>
      <div>
        <span className="label" id="gender-label">Gender</span>
        <div className="flex gap-3" role="radiogroup" aria-labelledby="gender-label">
          {GENDERS.map((g) => (
            <button key={g.value} type="button" role="radio" aria-checked={form.gender === g.value}
              onClick={() => { update("gender", g.value); update("selectedImplements", []); }}
              className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${form.gender === g.value ? "border-[var(--color-gold)] bg-primary-500/[0.08]" : "border-[var(--card-border)]"}`}
            >
              <span className="font-medium text-sm text-[var(--foreground)]">{g.label}</span>
            </button>
          ))}
        </div>
        {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
      </div>
      <div>
        <label className="label" htmlFor="pr">Competition PR (meters)</label>
        <input id="pr" type="number" step="0.01" min="0" className="input w-full" placeholder="e.g. 55.20"
          value={form.competitionPr} onChange={(e) => update("competitionPr", e.target.value)} />
        {errors.competitionPr && <p className="text-red-500 text-xs mt-1">{errors.competitionPr}</p>}
      </div>
    </div>
  );
}

function StepShortTermGoal({ form, update, errors = {} }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="label" htmlFor="stGoal">Short-Term Goal Label</label>
        <input id="stGoal" type="text" className="input w-full" placeholder='e.g. "Hit 18m at regionals"'
          value={form.shortTermGoal} onChange={(e) => update("shortTermGoal", e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="goalDist">Goal Distance (meters)</label>
        <input id="goalDist" type="number" step="0.01" min="0" className="input w-full" placeholder="e.g. 18.00"
          value={form.goalDistance} onChange={(e) => update("goalDistance", e.target.value)} />
        {form.competitionPr && form.goalDistance && (
          <p className="text-caption text-muted mt-1">+{(parseFloat(form.goalDistance) - parseFloat(form.competitionPr)).toFixed(2)}m improvement target</p>
        )}
        {errors.goalDistance && <p className="text-red-500 text-xs mt-1">{errors.goalDistance}</p>}
      </div>
      <div>
        <label className="label" htmlFor="targetDate">Target Date</label>
        <input id="targetDate" type="date" className="input w-full" value={form.targetDate} onChange={(e) => update("targetDate", e.target.value)} />
        {form.targetDate && (
          <p className="text-caption text-muted mt-1">
            {Math.ceil((new Date(form.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7))} weeks from now
          </p>
        )}
        {errors.targetDate && <p className="text-red-500 text-xs mt-1">{errors.targetDate}</p>}
      </div>
    </div>
  );
}

function StepLongTermGoal({ form, update }: StepProps) {
  return (
    <div className="space-y-6">
      <p className="text-body text-muted">Optional — set a longer-horizon goal beyond the current program.</p>
      <div>
        <label className="label" htmlFor="ltGoal">Long-Term Goal Label</label>
        <input id="ltGoal" type="text" className="input w-full" placeholder='e.g. "Qualify for nationals"'
          value={form.longTermGoal} onChange={(e) => update("longTermGoal", e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="ltDist">Long-Term Goal Distance (meters)</label>
        <input id="ltDist" type="number" step="0.01" min="0" className="input w-full" placeholder="e.g. 20.00"
          value={form.longTermDistance} onChange={(e) => update("longTermDistance", e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="ltDate">Long-Term Target Date</label>
        <input id="ltDate" type="date" className="input w-full" value={form.longTermDate} onChange={(e) => update("longTermDate", e.target.value)} />
      </div>
    </div>
  );
}

function StepCompetitions({ form, update }: StepProps) {
  const comps = form.competitions;
  const addRow = () => update("competitions", [...comps, { name: "", date: "", event: form.event || "", priority: "B" as const }]);
  const removeRow = (i: number) => update("competitions", comps.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof Competition, value: string) => {
    const next = [...comps];
    next[i] = { ...next[i], [field]: value };
    update("competitions", next);
  };

  return (
    <div className="space-y-4">
      <p className="text-body text-muted">Add your upcoming competitions. At least one is recommended.</p>
      {comps.map((comp, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1 grid grid-cols-2 gap-2">
            <input type="text" className="input text-sm" placeholder="Competition name" aria-label={`Competition ${i + 1} name`} value={comp.name}
              onChange={(e) => updateRow(i, "name", e.target.value)} />
            <input type="date" className="input text-sm" aria-label={`Competition ${i + 1} date`} value={comp.date}
              onChange={(e) => updateRow(i, "date", e.target.value)} />
          </div>
          <div className="flex gap-1" role="radiogroup" aria-label={`Priority for competition ${i + 1}`}>
            {(["A", "B", "C"] as const).map((p) => (
              <button key={p} type="button" onClick={() => updateRow(i, "priority", p)}
                role="radio"
                aria-checked={comp.priority === p}
                aria-label={`Priority ${p}`}
                className={`w-7 h-7 min-w-[44px] min-h-[44px] rounded-lg text-[10px] font-bold transition-all ${
                  comp.priority === p
                    ? p === "A" ? "bg-red-500 text-white" : p === "B" ? "bg-amber-500 text-white" : "bg-surface-400 text-white"
                    : "bg-[var(--muted-bg)] text-muted"
                }`}
              >{p}</button>
            ))}
          </div>
          {comps.length > 1 && (
            <button type="button" onClick={() => removeRow(i)}
              aria-label={`Remove competition ${comp.name || i + 1}`}
              className="text-muted hover:text-red-500 mt-2 min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)] rounded"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={addRow} className="text-sm text-[var(--color-gold-dark)] hover:underline">+ Add Competition</button>
    </div>
  );
}

function StepImplements({ form, update, errors = {}, options }: StepProps & { options: ImplementOption[] }) {
  const toggle = (wKg: number) => {
    const current = form.selectedImplements;
    update("selectedImplements", current.includes(wKg) ? current.filter((w) => w !== wKg) : [...current, wKg]);
  };
  if (!form.event || !form.gender) return <p className="text-muted text-sm">Select event and gender first (Step 1).</p>;
  return (
    <div className="space-y-4">
      <p className="text-body text-muted">Select all implements you have access to. Competition weight is auto-included.</p>
      <div className="space-y-2">
        {options.map((impl) => {
          const selected = form.selectedImplements.includes(impl.weightKg) || impl.isCompetition;
          return (
            <button key={impl.weightKg} type="button" onClick={() => { if (!impl.isCompetition) toggle(impl.weightKg); }}
              disabled={impl.isCompetition}
              role="checkbox"
              aria-checked={selected}
              aria-label={`${impl.label}${impl.isCompetition ? " (required)" : ""}`}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)] ${selected ? "border-[var(--color-gold)] bg-primary-500/[0.08]" : "border-[var(--card-border)]"} ${impl.isCompetition ? "opacity-80" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selected ? "bg-[var(--color-gold)] border-[var(--color-gold)]" : "border-[var(--foreground)]/30"}`}>
                  {selected && <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="font-medium text-sm text-[var(--foreground)]">{impl.label}</span>
              </div>
              {impl.isCompetition && <span className="text-xs bg-primary-500/[0.12] text-primary-600 px-2 py-0.5 rounded-full">Required</span>}
            </button>
          );
        })}
      </div>
      {errors.implements && <p className="text-red-500 text-xs">{errors.implements}</p>}
    </div>
  );
}

function StepFacilities({ form, update }: StepProps) {
  const toggleGymItem = (key: string) => update("gymEquipment", { ...form.gymEquipment, [key]: !form.gymEquipment[key] });
  const facilities = [
    { key: "hasCage" as const, label: "Throwing Cage", desc: "Enclosed cage for disc/hammer" },
    { key: "hasRing" as const, label: "Throwing Ring", desc: "Concrete circle/ring" },
    { key: "hasFieldAccess" as const, label: "Field Access", desc: "Open field for throwing" },
    { key: "hasGym" as const, label: "Weight Room", desc: "Gym for strength training" },
  ];
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {facilities.map((f) => (
          <button key={f.key} type="button" onClick={() => update(f.key, !form[f.key])}
            role="switch"
            aria-checked={form[f.key]}
            aria-label={f.label}
            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${form[f.key] ? "border-[var(--color-gold)] bg-primary-500/[0.08]" : "border-[var(--card-border)]"}`}
          >
            <div><span className="font-medium text-sm text-[var(--foreground)]">{f.label}</span><p className="text-xs text-muted">{f.desc}</p></div>
            <div aria-hidden="true" className={`w-10 h-6 rounded-full transition-colors relative ${form[f.key] ? "bg-[var(--color-gold)]" : "bg-surface-400"}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form[f.key] ? "translate-x-[18px]" : "translate-x-0.5"}`} />
            </div>
          </button>
        ))}
      </div>
      {form.hasGym && (
        <div>
          <p className="label mb-2">Gym Equipment</p>
          <div className="grid grid-cols-2 gap-2">
            {GYM_EQUIPMENT_OPTIONS.map((eq) => (
              <button key={eq.key} type="button" onClick={() => toggleGymItem(eq.key)}
                role="checkbox"
                aria-checked={!!form.gymEquipment[eq.key]}
                className={`p-2.5 rounded-lg border text-left text-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)] ${form.gymEquipment[eq.key] ? "border-[var(--color-gold)] bg-primary-500/[0.08] font-medium" : "border-[var(--card-border)] text-muted"}`}
              >{eq.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StepLifting({ form, update }: StepProps) {
  const lifts = [
    { key: "squatKg" as const, label: "Back Squat" },
    { key: "benchKg" as const, label: "Bench Press" },
    { key: "cleanKg" as const, label: "Power Clean" },
    { key: "snatchKg" as const, label: "Power Snatch" },
    { key: "ohpKg" as const, label: "Overhead Press" },
    { key: "rdlKg" as const, label: "RDL / Deadlift" },
  ];
  return (
    <div className="space-y-5">
      <p className="text-body text-muted">Enter your 1RM or best recent working weight. Leave blank if unknown.</p>
      <div>
        <label className="label" htmlFor="bodyweight">Body Weight (kg)</label>
        <input id="bodyweight" type="number" step="0.1" min="0" className="input w-full" placeholder="e.g. 90"
          value={form.bodyWeightKg} onChange={(e) => update("bodyWeightKg", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {lifts.map((lift) => (
          <div key={lift.key}>
            <label className="label text-xs" htmlFor={lift.key}>{lift.label}</label>
            <input id={lift.key} type="number" step="0.5" min="0" className="input w-full" placeholder="kg"
              value={form[lift.key]} onChange={(e) => update(lift.key, e.target.value)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StepMobility({ form, update }: StepProps) {
  const updateRegion = (i: number, field: keyof MobilityRegion, value: string) => {
    const next = [...form.mobilityRegions];
    next[i] = { ...next[i], [field]: value };
    update("mobilityRegions", next);
  };
  const severityColors: Record<string, string> = {
    none: "bg-[var(--muted-bg)] text-muted",
    mild: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
    moderate: "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400",
    severe: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400",
  };
  return (
    <div className="space-y-4">
      <p className="text-body text-muted">Optional — flag any mobility restrictions or injury history.</p>
      {form.mobilityRegions.map((region, i) => (
        <div key={region.area} className="flex items-center gap-3">
          <span className="text-sm text-[var(--foreground)] w-24 shrink-0">{region.area}</span>
          <div className="flex gap-1" role="radiogroup" aria-label={`${region.area} severity`}>
            {(["none", "mild", "moderate", "severe"] as const).map((sev) => (
              <button key={sev} type="button" onClick={() => updateRegion(i, "severity", sev)}
                role="radio"
                aria-checked={region.severity === sev}
                className={`px-2 py-1 min-h-[44px] rounded-lg text-[10px] font-medium transition-all ${region.severity === sev ? severityColors[sev] : "bg-[var(--muted-bg)] text-muted"}`}
              >{sev}</button>
            ))}
          </div>
          {region.severity !== "none" && (
            <input type="text" className="input text-xs flex-1" placeholder="Notes..." aria-label={`${region.area} notes`}
              value={region.notes} onChange={(e) => updateRegion(i, "notes", e.target.value)} />
          )}
        </div>
      ))}
    </div>
  );
}

function StepTrainingHistory({ form, update, errors = {} }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor="years">Years of Throwing Experience *</label>
        <input id="years" type="number" step="0.5" min="0" className="input w-full" placeholder="e.g. 3"
          value={form.yearsThrowing} onChange={(e) => update("yearsThrowing", e.target.value)} />
        {errors.yearsThrowing && <p className="text-red-500 text-xs mt-1">{errors.yearsThrowing}</p>}
      </div>
      <div>
        <label className="label" htmlFor="vol">Current Weekly Throw Volume (approx)</label>
        <input id="vol" type="number" min="0" className="input w-full" placeholder="e.g. 120 throws/week"
          value={form.currentWeeklyVolume} onChange={(e) => update("currentWeeklyVolume", e.target.value)} />
      </div>
      <div>
        <span className="label" id="days-label">Training Days per Week</span>
        <div className="flex gap-2" role="radiogroup" aria-labelledby="days-label">
          {[2, 3, 4, 5, 6].map((d) => (
            <button key={d} type="button" role="radio" aria-checked={form.daysPerWeek === d} onClick={() => update("daysPerWeek", d)}
              className={`flex-1 p-3 rounded-xl border-2 text-center font-semibold transition-all ${form.daysPerWeek === d ? "border-[var(--color-gold)] bg-primary-500/[0.08] text-[var(--color-gold-dark)]" : "border-[var(--card-border)] text-muted"}`}
            >{d}</button>
          ))}
        </div>
      </div>
      <div>
        <span className="label" id="sessions-label">Sessions per Day</span>
        <div className="flex gap-3" role="radiogroup" aria-labelledby="sessions-label">
          {[1, 2].map((s) => (
            <button key={s} type="button" role="radio" aria-checked={form.sessionsPerDay === s} onClick={() => update("sessionsPerDay", s)}
              className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${form.sessionsPerDay === s ? "border-[var(--color-gold)] bg-primary-500/[0.08]" : "border-[var(--card-border)]"}`}
            >
              <span className="font-semibold text-[var(--foreground)]">{s}</span>
              <p className="text-xs text-muted mt-0.5">{s === 1 ? "Single session" : "AM/PM split"}</p>
            </button>
          ))}
        </div>
      </div>
      <button type="button" onClick={() => update("includeLift", !form.includeLift)}
        role="switch"
        aria-checked={form.includeLift}
        aria-label="Include Strength Training"
        className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${form.includeLift ? "border-[var(--color-gold)] bg-primary-500/[0.08]" : "border-[var(--card-border)]"}`}
      >
        <div><span className="font-medium text-sm text-[var(--foreground)]">Include Strength Training</span></div>
        <div aria-hidden="true" className={`w-10 h-6 rounded-full transition-colors relative ${form.includeLift ? "bg-[var(--color-gold)]" : "bg-surface-400"}`}>
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.includeLift ? "translate-x-[18px]" : "translate-x-0.5"}`} />
        </div>
      </button>
    </div>
  );
}

function StepTyping({ form, update }: StepProps) {
  return (
    <div className="space-y-5">
      {form.hasTyping ? (
        <>
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-xl">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Adaptation Profile Found</p>
            <div className="mt-2 space-y-1 text-xs text-emerald-700 dark:text-emerald-400">
              <p>Adaptation Group: <strong>{form.adaptationGroup}</strong> ({form.adaptationGroup === 1 ? "Fast" : form.adaptationGroup === 2 ? "Moderate" : "Slow"})</p>
              <p>Sessions to Form: <strong>{form.sessionsToForm}</strong></p>
              <p>Method: <strong>{form.recommendedMethod}</strong></p>
              {form.transferType && <p>Transfer Type: <strong>{form.transferType}</strong></p>}
            </div>
          </div>
          <button type="button" onClick={() => update("useExistingTyping", !form.useExistingTyping)}
            className={`w-full p-3 rounded-xl border-2 text-center transition-all ${form.useExistingTyping ? "border-[var(--color-gold)] bg-primary-500/[0.08]" : "border-[var(--card-border)]"}`}
          >
            <span className="font-medium text-sm text-[var(--foreground)]">
              {form.useExistingTyping ? "Using existing results" : "Will retake quiz"}
            </span>
          </button>
          <p className="text-caption text-muted">
            To retake the quiz, visit My Training → My Typing after creating your program.
          </p>
        </>
      ) : (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">No Adaptation Profile Found</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            The program will use moderate adaptation defaults (Group 2, ~25 sessions to form).
            Complete the Typing Quiz in My Training → My Typing to personalize.
          </p>
        </div>
      )}
    </div>
  );
}

function StepReview({ form, implementOptions }: { form: FormState; implementOptions: ImplementOption[] }) {
  const eventLabel = EVENTS.find((e) => e.value === form.event)?.label ?? form.event;
  const selectedImpls = implementOptions.filter((i) => form.selectedImplements.includes(i.weightKg) || i.isCompetition);
  const weeksToTarget = form.targetDate ? Math.ceil((new Date(form.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7)) : 0;

  return (
    <div className="space-y-4">
      <h3 className="text-section font-heading text-[var(--foreground)]">Review Your Setup</h3>
      <div className="divide-y divide-[var(--card-border)]">
        <ReviewRow label="Event" value={`${eventLabel} (${form.gender})`} />
        <ReviewRow label="Competition PR" value={`${form.competitionPr}m`} />
        {form.shortTermGoal && <ReviewRow label="Short-Term Goal" value={`${form.shortTermGoal} — ${form.goalDistance}m by ${form.targetDate}`} />}
        {!form.shortTermGoal && <ReviewRow label="Goal" value={`${form.goalDistance}m by ${form.targetDate}`} />}
        {form.longTermGoal && <ReviewRow label="Long-Term Goal" value={`${form.longTermGoal} — ${form.longTermDistance}m`} />}
        <ReviewRow label="Implements" value={selectedImpls.map((i) => i.label).join(", ")} />
        <ReviewRow label="Schedule" value={`${form.daysPerWeek} days/week, ${form.sessionsPerDay} session/day${form.includeLift ? " + lifting" : ""}`} />
        <ReviewRow label="Experience" value={`${form.yearsThrowing} years${form.currentWeeklyVolume ? `, ~${form.currentWeeklyVolume} throws/week` : ""}`} />
        {form.bodyWeightKg && <ReviewRow label="Body Weight" value={`${form.bodyWeightKg}kg`} />}
        {form.hasTyping && <ReviewRow label="Adaptation" value={`Group ${form.adaptationGroup} — ${form.recommendedMethod}`} />}
      </div>

      {/* Preview reasoning cards */}
      <div className="space-y-2 mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Program Preview</h4>
        <div className="p-3 rounded-xl bg-[var(--muted-bg)] text-xs text-[var(--foreground)] space-y-1.5">
          <p>Your adaptation group is {form.adaptationGroup} ({form.adaptationGroup === 1 ? "fast" : form.adaptationGroup === 2 ? "moderate" : "slow"}). Phases will average {form.adaptationGroup === 1 ? "3-4" : form.adaptationGroup === 2 ? "4-5" : "5-7"} weeks.</p>
          <p>Target: {form.goalDistance}m by {form.targetDate} — {weeksToTarget}-week program.</p>
          <p>{selectedImpls.length} implements selected for descending weight protocol.</p>
        </div>
      </div>

      <div className="p-4 bg-primary-500/[0.08] border border-primary-500/20 rounded-xl mt-4">
        <p className="text-sm text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)]">
          Your program will be generated using Bondarchuk periodization methodology, customized for your event, level, and adaptation profile.
        </p>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium text-[var(--foreground)] text-right max-w-[60%]">{value}</span>
    </div>
  );
}
