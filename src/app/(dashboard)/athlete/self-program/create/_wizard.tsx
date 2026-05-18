"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { reportApiError } from "@/lib/form-errors";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components";
import { SaveStatusChip } from "@/components/ui/SaveStatusChip";
import { useDraftResumeToast } from "@/components/ui/DraftResumeToast";
import { useDraftPersistence } from "@/lib/draft-persistence";
import { useOutboxStatus } from "@/lib/outbox";

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
import { logger } from "@/lib/logger";

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

export interface PrefillData {
  currentPR: number | null;
  yearsExperience: number | null;
  competitionLevel: string | null;
  currentWeeklyVolume: number | null;
  daysPerWeek: number | null;
  sessionsPerDay: number | null;
  preferredDays: unknown;
  primaryGoal: string | null;
  generationMode: string | null;
  programType: string | null;
  performanceBenchmarks: string | null;
}

interface SelfProgramWizardProps {
  /** Server session userId — scopes the IDB draft cache for the new-program path. */
  userId: string;
  athleteId: string;
  athleteEvents: string[];
  athleteGender: string;
  athleteWeightKg: number | null;
  hasTypingData: boolean;
  existingImplements: string | null;
  exercises: ExerciseItem[];
  draft: DraftData;
  prefill?: PrefillData;
}

/** Persisted client-side wizard state — catches the window between
 *  server-side draft PUTs (which fire on each `nextStep`). Tab kill
 *  mid-typing on a step doesn't lose the in-flight values. */
interface SelfProgramClientDraft {
  step: number;
  form: WizardFormState;
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
  draft: DraftData,
  prefill?: PrefillData
): WizardFormState {
  if (draft) {
    return {
      programType: draft.programType || "",
      event: draft.event || athleteEvents[0] || "",
      gender: draft.gender || athleteGender || "",
      yearsExperience: draft.yearsExperience?.toString() || "",
      competitionLevel: draft.competitionLevel || "",
      currentPR: draft.currentPR?.toString() || "",
      goalDistance: draft.goalDistance?.toString() || "",
      currentWeeklyVolume: draft.currentWeeklyVolume?.toString() || "",
      selectedImplements: Array.isArray(draft.availableImplements)
        ? (draft.availableImplements as { weightKg: number }[]).map((i) => i.weightKg)
        : [],
      adaptationSpeed:
        (draft.inlineTypingData as { adaptationSpeed?: number } | null)?.adaptationSpeed ?? 2,
      transferType:
        (draft.inlineTypingData as { transferType?: string } | null)?.transferType ?? "BALANCED",
      recoveryProfile:
        (draft.inlineTypingData as { recoveryProfile?: string } | null)?.recoveryProfile ??
        "MODERATE",
      daysPerWeek: draft.daysPerWeek || 4,
      sessionsPerDay: draft.sessionsPerDay || 1,
      preferredDays: Array.isArray(draft.preferredDays) ? draft.preferredDays : [],
      startDate: draft.startDate ? new Date(draft.startDate).toISOString().split("T")[0] : "",
      competitions: Array.isArray(draft.competitionDates)
        ? (draft.competitionDates as CompetitionEntry[])
        : [],
      primaryGoal: draft.primaryGoal || "",
      generationMode: draft.generationMode || "",
      preferredExercises:
        (draft.exercisePreferences as { preferred?: string[] } | null)?.preferred ?? [],
      avoidedExercises: (draft.exercisePreferences as { avoided?: string[] } | null)?.avoided ?? [],
      favoriteDrills:
        (draft.exercisePreferences as { favoriteDrills?: string[] } | null)?.favoriteDrills ?? [],
    };
  }

  // Auto-prefill from athlete profile + previous program config + PRs.
  // Fields the athlete already entered once shouldn't need re-entering.
  const pf = prefill;

  return {
    programType: (pf?.programType as WizardFormState["programType"]) || "",
    event: athleteEvents[0] || "",
    gender: athleteGender || "",
    yearsExperience: pf?.yearsExperience?.toString() || "",
    competitionLevel: pf?.competitionLevel || "",
    currentPR: pf?.currentPR?.toString() || "",
    goalDistance: "",
    currentWeeklyVolume: pf?.currentWeeklyVolume?.toString() || "",
    selectedImplements: [],
    adaptationSpeed: 2,
    transferType: "BALANCED",
    recoveryProfile: "MODERATE",
    daysPerWeek: pf?.daysPerWeek ?? 4,
    sessionsPerDay: pf?.sessionsPerDay ?? 1,
    preferredDays: Array.isArray(pf?.preferredDays) ? (pf.preferredDays as string[]) : [],
    startDate: new Date().toISOString().split("T")[0],
    competitions: [],
    primaryGoal: pf?.primaryGoal || "",
    generationMode: pf?.generationMode || "",
    preferredExercises: [],
    avoidedExercises: [],
    favoriteDrills: [],
  };
}

// ── Main Wizard Component ──────────────────────────────────────────────

export function SelfProgramWizard({
  userId,
  athleteId,
  athleteEvents,
  athleteGender,
  athleteWeightKg: _athleteWeightKg,
  hasTypingData,
  existingImplements,
  exercises,
  draft,
  prefill,
}: SelfProgramWizardProps) {
  const router = useRouter();
  const toast = useToast();
  const { success, celebration } = toast;
  const { confirm, Dialog: ConfirmDialogPortal } = useConfirm();
  const showResumeToast = useDraftResumeToast();
  const outboxStatus = useOutboxStatus();
  const resumeToastFiredRef = useRef(false);

  const initialForm = useMemo(
    () => buildDefaultForm(athleteEvents, athleteGender, draft, prefill),
    [athleteEvents, athleteGender, draft, prefill]
  );
  const initialClientDraft = useMemo<SelfProgramClientDraft>(
    () => ({ step: 0, form: initialForm }),
    [initialForm]
  );

  // Persist {step, form} client-side to bridge the gap between server PUTs
  // (which fire on each nextStep). Disabled when resuming an existing server
  // draft via the ?draft=<id> URL — the server is the source of truth there
  // and re-loading would conflict with the prefill the page already injected.
  const isResumingServerDraft = !!(draft as { id?: string } | null)?.id;
  const draftKey = isResumingServerDraft ? null : `${userId}:self-program-create:new`;
  const [clientDraft, setClientDraft, draftStatus] = useDraftPersistence<SelfProgramClientDraft>(
    draftKey,
    initialClientDraft
  );

  const step = clientDraft.step;
  const form = clientDraft.form;
  const setStep = useCallback(
    (next: number | ((prev: number) => number)) =>
      setClientDraft((d) => ({ ...d, step: typeof next === "function" ? next(d.step) : next })),
    [setClientDraft]
  );
  const setForm = useCallback(
    (next: WizardFormState | ((prev: WizardFormState) => WizardFormState)) =>
      setClientDraft((d) => ({ ...d, form: typeof next === "function" ? next(d.form) : next })),
    [setClientDraft]
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(
    (draft as { id?: string } | null)?.id ?? null
  );

  // Stable per-attempt id for the final /generate POST. Reused across direct
  // submit and any retry, so the server's withIdempotency wrapper returns
  // the cached response on retry instead of generating a duplicate program.
  const idempotencyKeyRef = useRef<string>("");
  if (!idempotencyKeyRef.current) {
    idempotencyKeyRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  // ── Active steps (filtered by skip conditions) ───────────────────

  const activeSteps = useMemo(
    () => ALL_STEPS.filter((s) => !s.skip?.(form, hasTypingData)),
    [form, hasTypingData]
  );

  const currentStepConfig = activeSteps[step];
  const totalSteps = activeSteps.length;
  const isLastStep = step === totalSteps - 1;

  // ── Resume toast for a recovered client draft ────────────────────────
  // Skipped when resuming a server draft (those route through the page's
  // ?draft=<id> prefill — no surprise to the user). For new programs, fires
  // when the user advanced past step 0 or filled in any meaningful field.
  const { hasDraft, lastSavedAt, clearDraft } = draftStatus;
  useEffect(() => {
    if (resumeToastFiredRef.current) return;
    if (!hasDraft || !lastSavedAt) return;
    const startedFilling =
      step > 0 ||
      form.programType !== "" ||
      form.event !== "" ||
      form.currentPR !== "" ||
      form.goalDistance !== "";
    if (!startedFilling) return;

    resumeToastFiredRef.current = true;
    showResumeToast({
      lastSavedAt,
      noun: "program draft",
      onDiscard: async () => {
        await clearDraft();
        setClientDraft(initialClientDraft);
      },
    });
  }, [
    hasDraft,
    lastSavedAt,
    clearDraft,
    step,
    form.programType,
    form.event,
    form.currentPR,
    form.goalDistance,
    showResumeToast,
    setClientDraft,
    initialClientDraft,
  ]);

  // ── Form update ──────────────────────────────────────────────────

  const update = useCallback(
    (field: string, value: unknown) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [setForm]
  );

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
        if (form.selectedImplements.length === 0) errs.implements = "Select at least one implement";
        if (form.selectedImplements.length < 2)
          errs.implements = "Select at least 2 implements for optimal training";
        break;

      case "typing":
        // Typing step always valid — defaults are fine
        break;

      case "schedule":
        if (form.preferredDays.length === 0)
          errs.preferredDays = "Select at least one training day";
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
        currentWeeklyVolume: form.currentWeeklyVolume ? parseInt(form.currentWeeklyVolume) : null,
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

      const url = draftId ? `/api/athlete/self-program/${draftId}` : `/api/athlete/self-program`;

      const res = await fetch(url, {
        method: draftId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        // POST returns { success: true, data: { id } }; PUT has no id payload.
        const newId = data?.success ? data.data?.id : data?.id;
        if (newId && !draftId) setDraftId(newId);
      }
    } catch (err) {
      // Draft save failures are non-critical — silently continue
      logger.debug("Draft save failures are non-critical — silently continue", {
        context: "src/app/(dashboard)/athlete/self-program/create/_wizard.tsx",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
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
        currentWeeklyVolume: form.currentWeeklyVolume ? parseInt(form.currentWeeklyVolume) : null,
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

      // Resolve the config ID — use existing draft or create a new one
      let configId = draftId;

      if (configId) {
        // Save final state and mark as not-draft
        const putRes = await fetch(`/api/athlete/self-program/${configId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ ...payload, isDraft: false }),
        });
        if (!putRes.ok) {
          const err = await putRes.json().catch(() => null);
          reportApiError({ res: putRes, payload: err }, toast, {
            onRetry: handleGenerate,
            titleOverride: "Couldn't finalize program",
          });
          return;
        }
      } else {
        // Create config first if no draft exists
        const createRes = await fetch("/api/athlete/self-program", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify(payload),
        });
        if (!createRes.ok) {
          const err = await createRes.json().catch(() => null);
          reportApiError({ res: createRes, payload: err }, toast, {
            onRetry: handleGenerate,
            titleOverride: "Couldn't save program config",
          });
          return;
        }
        const created = await createRes.json();
        configId = created?.success ? created.data?.id : created?.id;
        setDraftId(configId);
        // Mark as finalized
        await fetch(`/api/athlete/self-program/${configId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ ...payload, isDraft: false }),
        });
      }

      // After the create/PUT block above, configId is guaranteed non-null.
      // Narrow for TS + defensive in case a future caller skips the create step.
      if (!configId) {
        setErrors({ generate: "Could not resolve program config — refresh and try again." });
        return;
      }
      const resolvedConfigId = configId;

      const res = await fetch(`/api/athlete/self-program/${resolvedConfigId}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKeyRef.current,
          ...csrfHeaders(),
        },
      });

      // Handle 409 conflict — another active program exists. Open a themed
      // dialog instead of window.confirm; the rest of the flow continues from
      // the dialog's onConfirm callback.
      if (res.status === 409) {
        const err = await res.json();
        const conflictingId = err.conflictingId;
        if (conflictingId) {
          setGenerating(false); // unlock the UI while the user decides
          confirm({
            title: "Replace existing program?",
            description:
              "You already have an active training program. Replacing it will deactivate the old one — completed sessions are preserved in your history.",
            confirmLabel: "Replace",
            onConfirm: () => {
              void replaceAndRetry(resolvedConfigId, conflictingId);
            },
          });
          return;
        }
      }

      await finalizeGenerateResponse(res, resolvedConfigId);
    } catch (err) {
      logger.error("program generation failed", {
        context: "athlete/self-program/create/wizard",
        error: err,
      });
      const info = reportApiError({ err }, toast, { onRetry: handleGenerate });
      setErrors({ generate: info.message });
    } finally {
      setGenerating(false);
    }
  }

  // ── Helpers extracted from handleGenerate so the 409 dialog can re-enter
  //    the flow after the user confirms replacement.

  async function finalizeGenerateResponse(res: Response, configId: string) {
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      const info = reportApiError({ res, payload: err }, toast, {
        onRetry: handleGenerate,
        titleOverride: "Generation Failed",
      });
      setErrors({ generate: info.message });
      return;
    }

    const result = await res.json();
    const programData = result.data || result;
    celebration("Program Generated!", {
      description: "Your Bondarchuk-based training program is ready",
      highlight: `${programData.totalWeeks} weeks`,
    });
    success("Program created successfully");
    // Drop the client-side draft now that the program is live on the server.
    await draftStatus.clearDraft();
    router.push(`/athlete/self-program/${configId}`);
  }

  async function replaceAndRetry(configId: string, conflictingId: string) {
    setGenerating(true);
    try {
      // Deactivate the conflicting program
      await fetch(`/api/athlete/self-program/${conflictingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ isActive: false }),
      });
      // Retry generate. Same idempotency key — the conflict was on an OLD
      // program; the generate request itself hasn't changed.
      const res = await fetch(`/api/athlete/self-program/${configId}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKeyRef.current,
          ...csrfHeaders(),
        },
      });
      await finalizeGenerateResponse(res, configId);
    } catch (err) {
      logger.error("program replace + regenerate failed", {
        context: "athlete/self-program/create/wizard",
        error: err,
      });
      const info = reportApiError({ err }, toast, { onRetry: handleGenerate });
      setErrors({ generate: info.message });
    } finally {
      setGenerating(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <Link
              href="/athlete/self-program"
              className="text-muted hover:text-[var(--foreground)] transition-colors"
              aria-label="Back to self program"
            >
              <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <h1 className="text-title font-heading text-[var(--foreground)]">Build Your Program</h1>
          </div>
          {(generating || !outboxStatus.isOnline || outboxStatus.pending > 0) && (
            <SaveStatusChip
              isSaving={generating}
              pending={outboxStatus.pending}
              isOnline={outboxStatus.isOnline}
              authNeeded={outboxStatus.authNeeded}
            />
          )}
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
                className={`flex items-center justify-center w-11 h-11 rounded-full text-sm font-semibold transition-all flex-shrink-0 ${
                  i === step
                    ? "bg-primary-500 text-black shadow-md"
                    : i < step
                      ? "bg-[rgba(212,168,67,0.2)] text-primary-600 dark:text-primary-500 cursor-pointer"
                      : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300"
                }`}
                aria-label={`Step ${i + 1}: ${s.label}`}
              >
                {i < step ? <Check size={18} strokeWidth={2.5} aria-hidden="true" /> : i + 1}
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
            <StepPreferences form={form} update={update} errors={errors} exercises={exercises} />
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

      {/* Sticky nav — the wizard steps are long; pinning Back/Continue to
          the viewport bottom keeps the primary action thumb-reachable
          regardless of how far the athlete has scrolled into the form. */}
      <div
        className="sticky bottom-0 -mx-4 sm:-mx-6 mt-6 px-4 sm:px-6 py-3 bg-[var(--surface-overlay)] border-t border-[var(--card-border)] flex items-center justify-between gap-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <Button
          variant="secondary"
          onClick={prevStep}
          disabled={step === 0}
          leftIcon={<ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />}
        >
          Back
        </Button>

        {isLastStep ? null : (
          <Button
            variant="primary"
            onClick={nextStep}
            rightIcon={<ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />}
          >
            Continue
          </Button>
        )}
      </div>
      <ConfirmDialogPortal />
    </div>
  );
}
