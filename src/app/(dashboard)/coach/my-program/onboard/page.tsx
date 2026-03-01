"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── Constants (duplicated from server constants to avoid importing server code) ─
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

// Implement lists by event+gender (matches server IMPLEMENTS constant)
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

const STEPS = [
 "Event & PR",
 "Goal",
 "Implements",
 "Facilities",
 "Lifting PRs",
 "Schedule",
 "Experience",
 "Review",
];

// ── Form State ────────────────────────────────────────────────────────

interface FormState {
 event: ThrowEvent | "";
 gender: Gender | "";
 competitionPr: string;
 goalDistance: string;
 targetDate: string;
 selectedImplements: number[]; // weightKg values
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
 daysPerWeek: number;
 sessionsPerDay: number;
 includeLift: boolean;
 yearsThowing: string;
 currentWeeklyVolume: string;
 currentPhase: string;
 // Typing (pre-filled if available)
 hasTyping: boolean;
 adaptationGroup: number;
 sessionsToForm: number;
 recommendedMethod: string;
}

const DEFAULT_FORM: FormState = {
 event: "",
 gender: "",
 competitionPr: "",
 goalDistance: "",
 targetDate: "",
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
 daysPerWeek: 4,
 sessionsPerDay: 1,
 includeLift: true,
 yearsThowing: "",
 currentWeeklyVolume: "",
 currentPhase: "",
 hasTyping: false,
 adaptationGroup: 2,
 sessionsToForm: 25,
 recommendedMethod: "complex",
};

// ── Main Component ────────────────────────────────────────────────────

export default function OnboardingWizardPage() {
 const router = useRouter();
 const [step, setStep] = useState(0);
 const [form, setForm] = useState<FormState>(DEFAULT_FORM);
 const [loading, setLoading] = useState(true);
 const [generating, setGenerating] = useState(false);
 const [errors, setErrors] = useState<Record<string, string>>({});

 // Fetch prefill data on mount
 useEffect(() => {
 async function fetchPrefill() {
 try {
 const res = await fetch("/api/throws/program/onboard");
 if (res.ok) {
 const { data } = await res.json();
 if (data?.prefill) {
 const p = data.prefill;
 setForm((prev) => ({
 ...prev,
 event: p.event || "",
 gender: p.gender || "",
 competitionPr: p.competitionPr?.toString() || "",
 hasTyping: data.hasTyping || false,
 adaptationGroup: p.typing?.adaptationGroup ?? 2,
 sessionsToForm: p.typing?.sessionsToForm ?? 25,
 recommendedMethod: p.typing?.recommendedMethod ?? "complex",
 }));
 }
 }
 } catch {
 // silently fail, user fills manually
 } finally {
 setLoading(false);
 }
 }
 fetchPrefill();
 }, []);

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

 // ── Step Validation ─────────────────────────────────────────────────

 function validateStep(s: number): boolean {
 const errs: Record<string, string> = {};

 if (s === 0) {
 if (!form.event) errs.event = "Select an event";
 if (!form.gender) errs.gender = "Select gender";
 if (!form.competitionPr || parseFloat(form.competitionPr) <= 0)
 errs.competitionPr = "Enter your competition PR";
 }

 if (s === 1) {
 if (!form.goalDistance || parseFloat(form.goalDistance) <= 0)
 errs.goalDistance = "Enter a goal distance";
 if (!form.targetDate) errs.targetDate = "Select a target date";
 if (
 form.targetDate &&
 new Date(form.targetDate) < new Date()
 )
 errs.targetDate = "Target date must be in the future";
 }

 if (s === 2) {
 if (form.selectedImplements.length === 0)
 errs.implements = "Select at least one implement";
 }

 if (s === 5) {
 // schedule — always valid with defaults
 }

 if (s === 6) {
 if (!form.yearsThowing || parseFloat(form.yearsThowing) < 0)
 errs.yearsThowing = "Enter years of throwing experience";
 if (!form.bodyWeightKg || parseFloat(form.bodyWeightKg) <= 0)
 errs.bodyWeightKg = "Enter your body weight";
 }

 setErrors(errs);
 return Object.keys(errs).length === 0;
 }

 function nextStep() {
 if (validateStep(step)) {
 setStep((s) => Math.min(s + 1, STEPS.length - 1));
 }
 }

 function prevStep() {
 setStep((s) => Math.max(s - 1, 0));
 }

 // ── Generate Program ────────────────────────────────────────────────

 async function handleGenerate() {
 if (!validateStep(6)) return; // re-validate experience step

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
 deadliftKg: form.deadliftKg ? parseFloat(form.deadliftKg) : undefined,
 bodyWeightKg: parseFloat(form.bodyWeightKg),
 },
 schedule: {
 daysPerWeek: form.daysPerWeek,
 sessionsPerDay: form.sessionsPerDay,
 includeLift: form.includeLift,
 },
 experience: {
 yearsThowing: parseFloat(form.yearsThowing),
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
 };

 // Save onboarding first
 await fetch("/api/throws/program/onboard", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(payload),
 });

 // Generate program
 const res = await fetch("/api/throws/program/generate", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(payload),
 });

 if (!res.ok) {
 const err = await res.json();
 setErrors({ generate: err.error || "Failed to generate program" });
 setGenerating(false);
 return;
 }

 const { data } = await res.json();
 router.push(`/coach/my-program?generated=${data.programId}`);
 } catch {
 setErrors({ generate: "Something went wrong. Please try again." });
 setGenerating(false);
 }
 }

 // ── Available Implements ────────────────────────────────────────────

 const implementOptions: ImplementOption[] =
 form.event && form.gender
 ? IMPLEMENTS_MAP[form.event as ThrowEvent]?.[form.gender as Gender] ?? []
 : [];

 // ── Render ──────────────────────────────────────────────────────────

 if (loading) {
 return (
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="animate-pulse text-[var(--color-text-3)]">Loading...</div>
 </div>
 );
 }

 return (
 <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
 {/* Header */}
 <div className="mb-8">
 <h1 className="text-title font-heading text-[var(--color-text)]">
 Create Training Program
 </h1>
 <p className="text-body text-[var(--color-text-2)] mt-1">
 Set up your Bondarchuk-based periodized training plan
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
 ? "bg-[var(--color-gold)] text-black shadow-md"
 : i < step
 ? "bg-[rgba(212,168,67,0.2)] text-[var(--color-gold-dark)] dark:text-[var(--color-gold)] cursor-pointer"
 : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)]"
 }`}
 >
 {i < step ? (
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
 </svg>
 ) : (
 i + 1
 )}
 </button>
 ))}
 </div>
 <div className="h-1.5 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden">
 <div
 className="h-full bg-[var(--color-gold)] rounded-full transition-all duration-500"
 style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
 />
 </div>
 <p className="text-caption text-[var(--color-text-2)] mt-2 text-center">
 Step {step + 1} of {STEPS.length}: {STEPS[step]}
 </p>
 </div>

 {/* Step Content */}
 <div className="card">
 {step === 0 && (
 <StepEventPr
 form={form}
 update={update}
 errors={errors}
 />
 )}
 {step === 1 && (
 <StepGoal form={form} update={update} errors={errors} />
 )}
 {step === 2 && (
 <StepImplements
 form={form}
 update={update}
 errors={errors}
 options={implementOptions}
 />
 )}
 {step === 3 && (
 <StepFacilities form={form} update={update} />
 )}
 {step === 4 && (
 <StepLifting form={form} update={update} errors={errors} />
 )}
 {step === 5 && (
 <StepSchedule form={form} update={update} />
 )}
 {step === 6 && (
 <StepExperience form={form} update={update} errors={errors} />
 )}
 {step === 7 && (
 <StepReview form={form} implementOptions={implementOptions} />
 )}
 </div>

 {/* Error */}
 {errors.generate && (
 <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">
 {errors.generate}
 </div>
 )}

 {/* Navigation */}
 <div className="flex items-center justify-between mt-6">
 {step === 0 ? (
 <Link
 href="/coach/my-program"
 className="btn-secondary px-5 py-2.5"
 >
 Cancel
 </Link>
 ) : (
 <button
 onClick={prevStep}
 className="btn-secondary px-5 py-2.5"
 >
 Back
 </button>
 )}

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
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
 </svg>
 Generating...
 </span>
 ) : (
 "Generate Program"
 )}
 </button>
 )}
 </div>
 </div>
 );
}

// ── Step Components ──────────────────────────────────────────────────

interface StepProps {
 form: FormState;
 update: (field: keyof FormState, value: FormState[keyof FormState]) => void;
 errors?: Record<string, string>;
}

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
 update("selectedImplements", []); // reset on event change
 }}
 className={`p-3 rounded-xl border-2 text-left transition-all ${
 form.event === ev.value
 ? "border-[var(--color-gold)] bg-[rgba(212,168,67,0.08)]"
 : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
 }`}
 >
 <div className="flex items-center gap-2">
 <div
 className="w-3 h-3 rounded-full"
 style={{ backgroundColor: ev.color }}
 />
 <span className="font-medium text-sm text-[var(--color-text)]">
 {ev.label}
 </span>
 </div>
 </button>
 ))}
 </div>
 {errors.event && <p className="text-red-500 text-xs mt-1">{errors.event}</p>}
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
 ? "border-[var(--color-gold)] bg-[rgba(212,168,67,0.08)]"
 : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
 }`}
 >
 <span className="font-medium text-sm text-[var(--color-text)]">
 {g.label}
 </span>
 </button>
 ))}
 </div>
 {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
 </div>

 <div>
 <label className="label" htmlFor="pr">
 Competition PR (meters)
 </label>
 <input
 id="pr"
 type="number"
 step="0.01"
 min="0"
 className="input w-full"
 placeholder="e.g. 55.20"
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

function StepGoal({ form, update, errors = {} }: StepProps) {
 return (
 <div className="space-y-6">
 <div>
 <label className="label" htmlFor="goalDist">
 Goal Distance (meters)
 </label>
 <input
 id="goalDist"
 type="number"
 step="0.01"
 min="0"
 className="input w-full"
 placeholder="e.g. 65.00"
 value={form.goalDistance}
 onChange={(e) => update("goalDistance", e.target.value)}
 />
 {form.competitionPr && form.goalDistance && (
 <p className="text-caption text-[var(--color-text-2)] mt-1">
 +{(parseFloat(form.goalDistance) - parseFloat(form.competitionPr)).toFixed(2)}m improvement target
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
 <p className="text-caption text-[var(--color-text-2)] mt-1">
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
 </div>
 );
}

function StepImplements({
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

 if (!form.event || !form.gender) {
 return (
 <p className="text-[var(--color-text-2)] text-sm">
 Please select event and gender first (Step 1).
 </p>
 );
 }

 return (
 <div className="space-y-4">
 <p className="text-body text-[var(--color-text-2)]">
 Select all implements you have access to for training.
 The competition weight is automatically included.
 </p>

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
 ? "border-[var(--color-gold)] bg-[rgba(212,168,67,0.08)]"
 : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
 } ${impl.isCompetition ? "opacity-80" : ""}`}
 >
 <div className="flex items-center gap-3">
 <div
 className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
 selected
 ? "bg-[var(--color-gold)] border-[var(--color-gold)]"
 : "border-[var(--color-border-strong)]"
 }`}
 >
 {selected && (
 <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
 </svg>
 )}
 </div>
 <span className="font-medium text-sm text-[var(--color-text)]">
 {impl.label}
 </span>
 </div>
 {impl.isCompetition && (
 <span className="text-xs bg-[rgba(212,168,67,0.12)] dark:bg-[rgba(212,168,67,0.15)] text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] px-2 py-0.5 rounded-full">
 Required
 </span>
 )}
 </button>
 );
 })}
 </div>

 {errors.implements && (
 <p className="text-red-500 text-xs">{errors.implements}</p>
 )}
 </div>
 );
}

function StepFacilities({ form, update }: StepProps) {
 const toggleGymItem = (key: string) => {
 update("gymEquipment", {
 ...form.gymEquipment,
 [key]: !form.gymEquipment[key],
 });
 };

 const facilities = [
 { key: "hasCage" as const, label: "Throwing Cage", desc: "Enclosed cage for disc/hammer" },
 { key: "hasRing" as const, label: "Throwing Ring", desc: "Concrete circle/ring" },
 { key: "hasFieldAccess" as const, label: "Field Access", desc: "Open field for throwing" },
 { key: "hasGym" as const, label: "Weight Room", desc: "Gym for strength training" },
 ];

 return (
 <div className="space-y-6">
 <div className="space-y-3">
 <p className="text-body text-[var(--color-text-2)]">
 What facilities do you have access to?
 </p>
 {facilities.map((f) => (
 <button
 key={f.key}
 type="button"
 onClick={() => update(f.key, !form[f.key])}
 className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
 form[f.key]
 ? "border-[var(--color-gold)] bg-[rgba(212,168,67,0.08)]"
 : "border-[var(--color-border)]"
 }`}
 >
 <div>
 <span className="font-medium text-sm text-[var(--color-text)]">
 {f.label}
 </span>
 <p className="text-xs text-[var(--color-text-2)]">{f.desc}</p>
 </div>
 <div
 className={`w-10 h-6 rounded-full transition-colors relative ${
 form[f.key]
 ? "bg-[var(--color-gold)]"
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
 <div>
 <p className="label mb-2">Gym Equipment Available</p>
 <div className="grid grid-cols-2 gap-2">
 {GYM_EQUIPMENT_OPTIONS.map((eq) => (
 <button
 key={eq.key}
 type="button"
 onClick={() => toggleGymItem(eq.key)}
 className={`p-2.5 rounded-lg border text-left text-sm transition-all ${
 form.gymEquipment[eq.key]
 ? "border-[var(--color-gold)] bg-[rgba(212,168,67,0.08)] font-medium"
 : "border-[var(--color-border)] text-[var(--color-text-2)]"
 }`}
 >
 {eq.label}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>
 );
}

function StepLifting({ form, update, errors = {} }: StepProps) {
 const lifts = [
 { key: "squatKg" as const, label: "Back Squat", placeholder: "kg" },
 { key: "benchKg" as const, label: "Bench Press", placeholder: "kg" },
 { key: "cleanKg" as const, label: "Power Clean", placeholder: "kg" },
 { key: "snatchKg" as const, label: "Power Snatch", placeholder: "kg" },
 { key: "ohpKg" as const, label: "Overhead Press", placeholder: "kg" },
 { key: "deadliftKg" as const, label: "Deadlift", placeholder: "kg" },
 ];

 return (
 <div className="space-y-5">
 <p className="text-body text-[var(--color-text-2)]">
 Enter your 1RM or best recent working weight. Leave blank if unknown.
 </p>

 <div>
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
 );
}

function StepSchedule({ form, update }: StepProps) {
 return (
 <div className="space-y-6">
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
 ? "border-[var(--color-gold)] bg-[rgba(212,168,67,0.08)] text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)]"
 : "border-[var(--color-border)] text-[var(--color-text-2)]"
 }`}
 >
 {d}
 </button>
 ))}
 </div>
 <p className="text-caption text-[var(--color-text-2)] mt-1">
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
 ? "border-[var(--color-gold)] bg-[rgba(212,168,67,0.08)]"
 : "border-[var(--color-border)]"
 }`}
 >
 <span className="font-semibold text-[var(--color-text)]">{s}</span>
 <p className="text-xs text-[var(--color-text-2)] mt-0.5">
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
 ? "border-[var(--color-gold)] bg-[rgba(212,168,67,0.08)]"
 : "border-[var(--color-border)]"
 }`}
 >
 <div>
 <span className="font-medium text-sm text-[var(--color-text)]">
 Include Strength Training
 </span>
 <p className="text-xs text-[var(--color-text-2)]">
 Prescribed lifts based on your PRs and phase
 </p>
 </div>
 <div
 className={`w-10 h-6 rounded-full transition-colors relative ${
 form.includeLift
 ? "bg-[var(--color-gold)]"
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
 );
}

function StepExperience({ form, update, errors = {} }: StepProps) {
 return (
 <div className="space-y-5">
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
 value={form.yearsThowing}
 onChange={(e) => update("yearsThowing", e.target.value)}
 />
 {errors.yearsThowing && (
 <p className="text-red-500 text-xs mt-1">{errors.yearsThowing}</p>
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
 <p className="text-caption text-[var(--color-text-2)] mt-1">
 Helps calibrate your starting volume to avoid injury
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

 {!form.hasTyping && (
 <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl">
 <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
 No Adaptation Profile Found
 </p>
 <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
 The program will use moderate adaptation defaults. Complete the
 Typing Quiz later to personalize your adaptation profile.
 </p>
 </div>
 )}
 </div>
 );
}

function StepReview({
 form,
 implementOptions,
}: {
 form: FormState;
 implementOptions: ImplementOption[];
}) {
 const eventLabel = EVENTS.find((e) => e.value === form.event)?.label ?? form.event;
 const selectedImpls = implementOptions.filter(
 (i) => form.selectedImplements.includes(i.weightKg) || i.isCompetition,
 );

 return (
 <div className="space-y-4">
 <h3 className="text-section font-heading text-[var(--color-text)]">
 Review Your Setup
 </h3>

 <div className="divide-y divide-gray-100 dark:divide-gray-800">
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
 value={`${form.yearsThowing} year${parseFloat(form.yearsThowing) !== 1 ? "s" : ""}${form.currentWeeklyVolume ? `, ~${form.currentWeeklyVolume} throws/week` : ""}`}
 />
 <ReviewRow
 label="Body Weight"
 value={`${form.bodyWeightKg}kg`}
 />
 {form.hasTyping && (
 <ReviewRow
 label="Adaptation"
 value={`Group ${form.adaptationGroup} — ${form.recommendedMethod}`}
 />
 )}
 </div>

 <div className="p-4 bg-[rgba(212,168,67,0.08)] border border-[rgba(212,168,67,0.2)]/30 rounded-xl mt-4">
 <p className="text-sm text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)]">
 Your program will be generated using Bondarchuk periodization
 methodology, customized for your event, level, and adaptation profile.
 </p>
 </div>
 </div>
 );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
 return (
 <div className="flex justify-between py-2.5">
 <span className="text-sm text-[var(--color-text-2)]">{label}</span>
 <span className="text-sm font-medium text-[var(--color-text)] text-right max-w-[60%]">
 {value}
 </span>
 </div>
 );
}
