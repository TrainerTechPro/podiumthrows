"use client";

import { useState, useTransition } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import { useRouter } from "next/navigation";
import { Badge } from "@/components";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Step = "select" | "correlations" | "determine" | "review";

type ExerciseOption = {
  id: string;
  name: string;
  category: string;
  correlation: number;
};

type CorrelationEntry = {
  exerciseId: string;
  exerciseName: string;
  category: string;
  score: number;
};

type AthleteType = "EXPLOSIVE" | "SPEED_STRENGTH" | "STRENGTH_SPEED" | "STRENGTH";

const STEP_LABELS = ["Select Exercises", "Record Correlations", "Determine Type", "Review & Save"];
const STEP_KEYS: Step[] = ["select", "correlations", "determine", "review"];

const ATHLETE_TYPES: { value: AthleteType; label: string; description: string }[] = [
  {
    value: "EXPLOSIVE",
    label: "Explosive",
    description: "Best transfer from competition & close-weight implements. Responds to specific, high-velocity exercises.",
  },
  {
    value: "SPEED_STRENGTH",
    label: "Speed-Strength",
    description: "Strong transfer from SDE exercises. Benefits from speed-focused training with moderate loads.",
  },
  {
    value: "STRENGTH_SPEED",
    label: "Strength-Speed",
    description: "Strong transfer from SPE exercises. Benefits from strength-focused training with sub-maximal loads.",
  },
  {
    value: "STRENGTH",
    label: "Strength",
    description: "Broad transfer from GPE and strength work. Benefits from general strength development.",
  },
];

const TYPE_COLORS: Record<AthleteType, string> = {
  EXPLOSIVE: "warning",
  SPEED_STRENGTH: "primary",
  STRENGTH_SPEED: "success",
  STRENGTH: "danger",
};

/* ─── Step Indicator ─────────────────────────────────────────────────────── */

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={[
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
              i < current
                ? "bg-primary-500 text-white"
                : i === current
                ? "bg-primary-500 text-white ring-4 ring-primary-500/20"
                : "bg-surface-200 dark:bg-surface-700 text-muted",
            ].join(" ")}
          >
            {i < current ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              i + 1
            )}
          </div>
          <span
            className={[
              "text-sm hidden sm:block",
              i === current ? "font-semibold text-[var(--foreground)]" : "text-muted",
            ].join(" ")}
          >
            {label}
          </span>
          {i < STEP_LABELS.length - 1 && (
            <div
              className={[
                "h-px flex-1 min-w-[24px] mx-1 transition-colors",
                i < current ? "bg-primary-500" : "bg-surface-200 dark:bg-surface-700",
              ].join(" ")}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Suggest Type from correlations ─────────────────────────────────────── */

function suggestType(entries: CorrelationEntry[]): AthleteType {
  if (entries.length === 0) return "EXPLOSIVE";

  const byCategory: Record<string, number[]> = {};
  for (const e of entries) {
    if (!byCategory[e.category]) byCategory[e.category] = [];
    byCategory[e.category].push(e.score);
  }

  const avgByCategory: Record<string, number> = {};
  for (const [cat, scores] of Object.entries(byCategory)) {
    avgByCategory[cat] = scores.reduce((s, v) => s + v, 0) / scores.length;
  }

  const ceAvg = avgByCategory["CE"] ?? 0;
  const sdeAvg = avgByCategory["SDE"] ?? 0;
  const speAvg = avgByCategory["SPE"] ?? 0;
  const gpeAvg = avgByCategory["GPE"] ?? 0;

  // Determine type based on where highest correlations are
  if (ceAvg >= sdeAvg && ceAvg >= speAvg && ceAvg >= gpeAvg) return "EXPLOSIVE";
  if (sdeAvg >= speAvg && sdeAvg >= gpeAvg) return "SPEED_STRENGTH";
  if (speAvg >= gpeAvg) return "STRENGTH_SPEED";
  return "STRENGTH";
}

/* ─── Wizard ─────────────────────────────────────────────────────────────── */

export function AssessmentWizard({
  athleteId,
  athleteName,
  exercises,
  previousType,
}: {
  athleteId: string;
  athleteName: string;
  exercises: ExerciseOption[];
  previousType: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("select");
  const [error, setError] = useState<string | null>(null);

  // Step 1: Selected exercises
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Step 2: Correlation scores
  const [correlations, setCorrelations] = useState<CorrelationEntry[]>([]);

  // Step 3: Athlete type
  const [selectedType, setSelectedType] = useState<AthleteType | null>(null);
  const [notes, setNotes] = useState("");

  const currentStepIdx = STEP_KEYS.indexOf(step);

  const toggleExercise = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const goToCorrelations = () => {
    const selected = exercises.filter((e) => selectedIds.has(e.id));
    setCorrelations(
      selected.map((e) => ({
        exerciseId: e.id,
        exerciseName: e.name,
        category: e.category,
        score: e.correlation, // pre-fill with known correlation
      }))
    );
    setStep("correlations");
  };

  const goToDetermine = () => {
    const suggested = suggestType(correlations);
    setSelectedType(suggested);
    setStep("determine");
  };

  const handleSave = async () => {
    if (!selectedType) return;

    setError(null);
    startTransition(async () => {
      try {
        const results: Record<string, { exerciseName: string; category: string; correlation: number }> = {};
        for (const c of correlations) {
          results[c.exerciseId] = {
            exerciseName: c.exerciseName,
            category: c.category,
            correlation: c.score,
          };
        }

        const res = await fetch("/api/coach/throws/assessment", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            athleteId,
            athleteType: selectedType,
            results,
            notes: notes || null,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to save assessment");
          return;
        }

        router.refresh();
        setStep("select");
        setSelectedIds(new Set());
        setCorrelations([]);
        setSelectedType(null);
        setNotes("");
      } catch {
        setError("Network error");
      }
    });
  };

  // Group exercises by category
  const grouped: Record<string, ExerciseOption[]> = {};
  for (const ex of exercises) {
    if (!grouped[ex.category]) grouped[ex.category] = [];
    grouped[ex.category].push(ex);
  }

  const categoryLabels: Record<string, string> = {
    CE: "Competition Exercises",
    SDE: "Special Developmental",
    SPE: "Special Preparatory",
    GPE: "General Preparatory",
  };

  return (
    <div>
      <StepIndicator current={currentStepIdx} />

      {error && (
        <div className="p-3 mb-4 rounded-lg bg-danger-500/10 text-danger-500 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Select Exercises */}
      {step === "select" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">
              Select Test Exercises
            </h2>
            <p className="text-sm text-muted mt-1">
              Choose 6-10 exercises across categories to assess transfer correlations for {athleteName}.
            </p>
          </div>

          {Object.entries(grouped).map(([cat, exs]) => (
            <div key={cat}>
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                {categoryLabels[cat] ?? cat} ({exs.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {exs.map((ex) => {
                  const checked = selectedIds.has(ex.id);
                  return (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => toggleExercise(ex.id)}
                      className={[
                        "text-left p-3 rounded-lg border transition-colors",
                        checked
                          ? "border-primary-500 bg-primary-500/5"
                          : "border-[var(--card-border)] hover:border-primary-500/50",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={[
                            "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                            checked
                              ? "bg-primary-500 border-primary-500"
                              : "border-surface-300 dark:border-surface-600",
                          ].join(" ")}
                        >
                          {checked && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium text-[var(--foreground)]">
                          {ex.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-4 border-t border-[var(--card-border)]">
            <p className="text-sm text-muted">
              {selectedIds.size} selected
              {selectedIds.size < 6 && " (min 6)"}
            </p>
            <button
              type="button"
              onClick={goToCorrelations}
              disabled={selectedIds.size < 6}
              className="btn btn-primary text-sm"
            >
              Next: Record Correlations
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Record Correlations */}
      {step === "correlations" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">
              Record Correlations
            </h2>
            <p className="text-sm text-muted mt-1">
              Adjust the correlation score (0.0-1.0) for each exercise based on observed transfer.
            </p>
          </div>

          <div className="space-y-3">
            {correlations.map((entry, i) => (
              <div
                key={entry.exerciseId}
                className="card p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {entry.exerciseName}
                    </span>
                    <Badge variant="neutral" className="ml-2 text-[10px]">
                      {entry.category}
                    </Badge>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-primary-500">
                    {entry.score.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={entry.score}
                  onChange={(e) => {
                    const next = [...correlations];
                    next[i] = { ...next[i], score: parseFloat(e.target.value) };
                    setCorrelations(next);
                  }}
                  className="w-full accent-primary-500"
                />
                <div className="flex justify-between text-[10px] text-muted mt-1">
                  <span>No Transfer</span>
                  <span>Strong Transfer</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[var(--card-border)]">
            <button
              type="button"
              onClick={() => setStep("select")}
              className="btn btn-ghost text-sm"
            >
              Back
            </button>
            <button
              type="button"
              onClick={goToDetermine}
              className="btn btn-primary text-sm"
            >
              Next: Determine Type
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Determine Athlete Type */}
      {step === "determine" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">
              Determine Athlete Type
            </h2>
            <p className="text-sm text-muted mt-1">
              Based on correlation patterns, select the Bondarchuk athlete type.
              {previousType && (
                <span className="ml-1">
                  Previous type: <strong>{previousType.replace(/_/g, " ")}</strong>
                </span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ATHLETE_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setSelectedType(type.value)}
                className={[
                  "text-left p-4 rounded-xl border-2 transition-all",
                  selectedType === type.value
                    ? "border-primary-500 bg-primary-500/5 shadow-sm"
                    : "border-[var(--card-border)] hover:border-primary-500/30",
                ].join(" ")}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={TYPE_COLORS[type.value] as "warning" | "primary" | "success" | "danger"}>
                    {type.label}
                  </Badge>
                  {selectedType === type.value && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-muted mt-1">{type.description}</p>
              </button>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Observations, context, training phase..."
              className="input w-full"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[var(--card-border)]">
            <button
              type="button"
              onClick={() => setStep("correlations")}
              className="btn btn-ghost text-sm"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep("review")}
              disabled={!selectedType}
              className="btn btn-primary text-sm"
            >
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Save */}
      {step === "review" && selectedType && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">
              Review & Save
            </h2>
            <p className="text-sm text-muted mt-1">
              Confirm the assessment for {athleteName}.
            </p>
          </div>

          <div className="card p-4 space-y-4">
            {/* Type */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Athlete Type</span>
              <Badge variant={TYPE_COLORS[selectedType] as "warning" | "primary" | "success" | "danger"}>
                {selectedType.replace(/_/g, " ")}
              </Badge>
            </div>

            {/* Correlations summary */}
            <div>
              <span className="text-sm text-muted">Exercises Assessed</span>
              <div className="mt-2 space-y-1">
                {correlations.map((c) => (
                  <div key={c.exerciseId} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--foreground)]">{c.exerciseName}</span>
                    <span
                      className={[
                        "font-bold tabular-nums",
                        c.score >= 0.7
                          ? "text-green-500"
                          : c.score >= 0.4
                          ? "text-amber-500"
                          : "text-red-500",
                      ].join(" ")}
                    >
                      {c.score.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {notes && (
              <div>
                <span className="text-sm text-muted">Notes</span>
                <p className="text-sm text-[var(--foreground)] mt-1">{notes}</p>
              </div>
            )}

            {previousType && previousType !== selectedType && (
              <div className="p-3 rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400 text-sm">
                Type changed from <strong>{previousType.replace(/_/g, " ")}</strong> to{" "}
                <strong>{selectedType.replace(/_/g, " ")}</strong>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[var(--card-border)]">
            <button
              type="button"
              onClick={() => setStep("determine")}
              className="btn btn-ghost text-sm"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="btn btn-primary text-sm"
            >
              {isPending ? "Saving..." : "Save Assessment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
