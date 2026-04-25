"use client";

import { useState, useTransition, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SaveStatusChip } from "@/components/ui/SaveStatusChip";
import { useDraftResumeToast } from "@/components/ui/DraftResumeToast";
import { useDraftPersistence } from "@/lib/draft-persistence";
import { useOutboxStatus } from "@/lib/outbox";
import { csrfHeaders } from "@/lib/csrf-client";
import { StepBasics, type BasicsData } from "./_step-basics";
import { StepBlocks, type BlockData } from "./_step-blocks";
import { StepExercises } from "./_step-exercises";
import { StepReview } from "./_step-review";
import type { ExerciseItem, AthletePickerItem } from "@/lib/data/coach";

/* ─── Types ───────────────────────────────────────────────────────────────── */

export type WizardState = {
  basics: BasicsData;
  blocks: BlockData[];
};

const STEPS = ["Basics", "Blocks", "Exercises", "Review"] as const;

/* ─── Component ───────────────────────────────────────────────────────────── */

/** Persisted wizard state — survives a tab kill mid-fill. */
interface SessionWizardDraft {
  step: number;
  basics: BasicsData;
  blocks: BlockData[];
  isTemplate: boolean;
  selectedAthletes: string[];
  scheduledDate: string;
  coachNotes: string;
}

export function SessionWizard({
  userId,
  exercises,
  athletes,
}: {
  userId: string;
  exercises: ExerciseItem[];
  athletes: AthletePickerItem[];
}) {
  const router = useRouter();
  const showResumeToast = useDraftResumeToast();
  const outboxStatus = useOutboxStatus();
  const resumeToastFiredRef = useRef(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initialDraft = useMemo<SessionWizardDraft>(
    () => ({
      step: 0,
      basics: { name: "", description: "", event: "" },
      blocks: [
        { name: "Warmup", blockType: "warmup", restSeconds: 0, notes: "", exercises: [] },
        {
          name: "Throwing Block 1",
          blockType: "throwing",
          restSeconds: 120,
          notes: "",
          exercises: [],
        },
        {
          name: "Strength Block",
          blockType: "strength",
          restSeconds: 90,
          notes: "",
          exercises: [],
        },
        { name: "Cooldown", blockType: "cooldown", restSeconds: 0, notes: "", exercises: [] },
      ],
      isTemplate: false,
      selectedAthletes: [],
      scheduledDate: "",
      coachNotes: "",
    }),
    []
  );
  const [draft, setDraft, draftStatus] = useDraftPersistence<SessionWizardDraft>(
    `${userId}:coach-plan-new:session`,
    initialDraft
  );

  // Stable per-attempt id for the plan-create POST. The assignment POST gets
  // its own key derived from this — server treats them as independent
  // operations (different endpoints) but we want both replays to be safe.
  const idempotencyKeyRef = useRef<string>("");
  if (!idempotencyKeyRef.current) {
    idempotencyKeyRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  // Backwards-compatible named accessors so the existing JSX (~400 lines below)
  // keeps working unchanged.
  const { step, basics, blocks, isTemplate, selectedAthletes, scheduledDate, coachNotes } = draft;
  const setStep = useCallback(
    (next: number | ((prev: number) => number)) =>
      setDraft((d) => ({ ...d, step: typeof next === "function" ? next(d.step) : next })),
    [setDraft]
  );
  const setBasics = useCallback(
    (next: BasicsData | ((prev: BasicsData) => BasicsData)) =>
      setDraft((d) => ({ ...d, basics: typeof next === "function" ? next(d.basics) : next })),
    [setDraft]
  );
  const setBlocks = useCallback(
    (next: BlockData[] | ((prev: BlockData[]) => BlockData[])) =>
      setDraft((d) => ({ ...d, blocks: typeof next === "function" ? next(d.blocks) : next })),
    [setDraft]
  );
  const setIsTemplate = useCallback(
    (next: boolean) => setDraft((d) => ({ ...d, isTemplate: next })),
    [setDraft]
  );
  const setSelectedAthletes = useCallback(
    (next: string[] | ((prev: string[]) => string[])) =>
      setDraft((d) => ({
        ...d,
        selectedAthletes: typeof next === "function" ? next(d.selectedAthletes) : next,
      })),
    [setDraft]
  );
  const setScheduledDate = useCallback(
    (next: string) => setDraft((d) => ({ ...d, scheduledDate: next })),
    [setDraft]
  );
  const setCoachNotes = useCallback(
    (next: string) => setDraft((d) => ({ ...d, coachNotes: next })),
    [setDraft]
  );

  // Resume toast for a recovered draft. Coach desk-class — the threshold is
  // relaxed (any non-default name or any added exercise counts as "started").
  const { hasDraft, lastSavedAt, clearDraft } = draftStatus;
  useEffect(() => {
    if (resumeToastFiredRef.current) return;
    if (!hasDraft || !lastSavedAt) return;
    const startedFilling =
      basics.name.trim() !== "" ||
      basics.description.trim() !== "" ||
      blocks.some((b) => b.exercises.length > 0) ||
      selectedAthletes.length > 0;
    if (!startedFilling) return;

    resumeToastFiredRef.current = true;
    showResumeToast({
      lastSavedAt,
      noun: "plan draft",
      onDiscard: async () => {
        await clearDraft();
        setDraft(initialDraft);
      },
    });
  }, [
    hasDraft,
    lastSavedAt,
    clearDraft,
    basics,
    blocks,
    selectedAthletes,
    showResumeToast,
    setDraft,
    initialDraft,
  ]);

  function canAdvance(): boolean {
    if (step === 0) {
      return basics.name.trim().length > 0;
    }
    if (step === 1) {
      return blocks.length > 0 && blocks.every((b) => b.name.trim().length > 0);
    }
    if (step === 2) {
      // At least one block must have exercises
      return blocks.some((b) => b.exercises.length > 0);
    }
    return true;
  }

  async function handleSave() {
    setError(null);

    startTransition(async () => {
      try {
        // 1. Create the plan. Idempotency key on this POST so a retry after
        // a dropped response returns the cached plan id instead of creating
        // a duplicate.
        const planRes = await fetch("/api/coach/plans", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Idempotency-Key": idempotencyKeyRef.current,
            ...csrfHeaders(),
          },
          body: JSON.stringify({
            name: basics.name.trim(),
            description: basics.description.trim() || undefined,
            event: basics.event || null,
            isTemplate,
            blocks: blocks.map((block) => ({
              name: block.name.trim(),
              blockType: block.blockType,
              restSeconds: block.restSeconds || null,
              notes: block.notes.trim() || null,
              exercises: block.exercises.map((ex) => ({
                exerciseId: ex.exerciseId,
                sets: ex.sets || null,
                reps: ex.reps.trim() || null,
                weight: ex.weight.trim() || null,
                rpe: ex.rpe || null,
                restSeconds: ex.restSeconds || null,
                notes: ex.notes.trim() || null,
                implementKg: ex.implementKg || null,
              })),
            })),
          }),
        });

        if (!planRes.ok) {
          const data = await planRes.json();
          setError(data.error ?? "Failed to create plan.");
          return;
        }

        const plan = await planRes.json();

        // 2. Optionally assign to athletes. Derived idempotency key so a
        // retry of step 2 doesn't double-assign — the assignment is keyed
        // by the same intent as the plan creation.
        if (selectedAthletes.length > 0 && scheduledDate) {
          const assignRes = await fetch("/api/coach/sessions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Idempotency-Key": `${idempotencyKeyRef.current}:assign`,
              ...csrfHeaders(),
            },
            body: JSON.stringify({
              planId: plan.id,
              athleteIds: selectedAthletes,
              scheduledDate,
              coachNotes: coachNotes.trim() || undefined,
            }),
          });

          if (!assignRes.ok) {
            const data = await assignRes.json();
            setError(data.error ?? "Plan saved, but failed to assign sessions.");
            return;
          }
        }

        // Plan is on the server — drop the persisted draft.
        await draftStatus.clearDraft();
        router.push("/coach/plans");
        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/coach/plans"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--foreground)] transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back to Plans
        </Link>
        {(isPending || !outboxStatus.isOnline || outboxStatus.pending > 0) && (
          <SaveStatusChip
            isSaving={isPending}
            pending={outboxStatus.pending}
            isOnline={outboxStatus.isOnline}
            authNeeded={outboxStatus.authNeeded}
          />
        )}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`w-8 h-px ${
                  i <= step ? "bg-primary-500" : "bg-surface-200 dark:bg-surface-700"
                }`}
              />
            )}
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                i === step
                  ? "bg-primary-500/10 text-primary-600 dark:text-primary-400"
                  : i < step
                    ? "text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer"
                    : "text-muted cursor-not-allowed"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                  i < step
                    ? "bg-primary-500 text-white"
                    : i === step
                      ? "bg-primary-500/20 text-primary-600 dark:text-primary-400"
                      : "bg-surface-200 dark:bg-surface-700 text-muted"
                }`}
              >
                {i < step ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="card p-6">
        {step === 0 && <StepBasics data={basics} onChange={setBasics} />}
        {step === 1 && <StepBlocks blocks={blocks} onChange={setBlocks} />}
        {step === 2 && (
          <StepExercises
            blocks={blocks}
            onChange={setBlocks}
            exercises={exercises}
            eventFilter={basics.event}
          />
        )}
        {step === 3 && (
          <StepReview
            basics={basics}
            blocks={blocks}
            exercises={exercises}
            athletes={athletes}
            isTemplate={isTemplate}
            onIsTemplateChange={setIsTemplate}
            selectedAthletes={selectedAthletes}
            onSelectedAthletesChange={setSelectedAthletes}
            scheduledDate={scheduledDate}
            onScheduledDateChange={setScheduledDate}
            coachNotes={coachNotes}
            onCoachNotesChange={setCoachNotes}
          />
        )}
      </div>

      {/* Error */}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={() => (step === 0 ? router.back() : setStep((s) => s - 1))}
          disabled={isPending}
        >
          {step === 0 ? "Cancel" : "Back"}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button variant="primary" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
            Next
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleSave}
            loading={isPending}
            disabled={!canAdvance()}
          >
            {selectedAthletes.length > 0 ? "Save & Assign" : "Save Plan"}
          </Button>
        )}
      </div>
    </div>
  );
}
