"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
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

export function SessionWizard({
  exercises,
  athletes,
}: {
  exercises: ExerciseItem[];
  athletes: AthletePickerItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [basics, setBasics] = useState<BasicsData>({
    name: "",
    description: "",
    event: "",
  });

  const [blocks, setBlocks] = useState<BlockData[]>([
    { name: "Warmup", blockType: "warmup", restSeconds: 0, notes: "", exercises: [] },
    { name: "Throwing Block 1", blockType: "throwing", restSeconds: 120, notes: "", exercises: [] },
    { name: "Strength Block", blockType: "strength", restSeconds: 90, notes: "", exercises: [] },
    { name: "Cooldown", blockType: "cooldown", restSeconds: 0, notes: "", exercises: [] },
  ]);

  // Save + assign state
  const [isTemplate, setIsTemplate] = useState(false);
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [coachNotes, setCoachNotes] = useState("");

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
        // 1. Create the plan
        const planRes = await fetch("/api/coach/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
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

        // 2. Optionally assign to athletes
        if (selectedAthletes.length > 0 && scheduledDate) {
          const assignRes = await fetch("/api/coach/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
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

        router.push("/coach/sessions");
        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
        {step === 0 && (
          <StepBasics data={basics} onChange={setBasics} />
        )}
        {step === 1 && (
          <StepBlocks blocks={blocks} onChange={setBlocks} />
        )}
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
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

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
          <Button
            variant="primary"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
          >
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
