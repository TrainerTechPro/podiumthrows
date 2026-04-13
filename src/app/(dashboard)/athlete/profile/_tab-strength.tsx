"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import { NumberFlow } from "@/components/ui/NumberFlow";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Input } from "@/components/ui/Input";
import type { ProfileData, LiftEntry } from "./_types";
import { LIFTS } from "./_types";

/* ─── Correlation options ───────────────────────────────────────────────── */

const CORRELATIONS = [
  { value: "STRONG", label: "Strong" },
  { value: "MODERATE", label: "Moderate" },
  { value: "WEAK", label: "Weak" },
  { value: "UNKNOWN", label: "Unknown" },
] as const;

/* ─── Ratio config ──────────────────────────────────────────────────────── */

const RATIOS = [
  { key: "backSquat", label: "Squat / BW", target: 2.0 },
  { key: "powerClean", label: "Clean / BW", target: 1.3 },
  { key: "snatch", label: "Snatch / BW", target: 1.0 },
] as const;

/* ─── Default values ────────────────────────────────────────────────────── */

const defaultLift: LiftEntry = { current: 0, date: "", goal: 0, correlation: "UNKNOWN" };

/* ─── Component ─────────────────────────────────────────────────────────── */

export function TabStrength({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();

  /* ── Lift state ────────────────────────────────────────────────────── */

  const [lifts, setLifts] = useState<Record<string, LiftEntry>>(() => {
    const existing = profile.strengthNumbers?.lifts ?? {};
    return Object.fromEntries(LIFTS.map((l) => [l.key, existing[l.key] ?? { ...defaultLift }]));
  });

  /* ── Athletic tests state ──────────────────────────────────────────── */

  const [tests, setTests] = useState(
    () => profile.strengthNumbers?.tests ?? { standingLJ: 0, tripleJump: 0 }
  );

  /* ── Computed ratios ───────────────────────────────────────────────── */

  const computedRatios = useMemo(() => {
    const bw = profile.weightKg;
    if (!bw || bw <= 0) {
      return { squatBW: 0, cleanBW: 0, snatchBW: 0 };
    }
    return {
      squatBW: lifts.backSquat?.current ? lifts.backSquat.current / bw : 0,
      cleanBW: lifts.powerClean?.current ? lifts.powerClean.current / bw : 0,
      snatchBW: lifts.snatch?.current ? lifts.snatch.current / bw : 0,
    };
  }, [lifts, profile.weightKg]);

  /* ── Lift updater ──────────────────────────────────────────────────── */

  function updateLift(key: string, field: keyof LiftEntry, value: string) {
    setLifts((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: field === "current" || field === "goal" ? parseFloat(value) || 0 : value,
      },
    }));
  }

  /* ── Save ───────────────────────────────────────────────────────────── */

  function handleSave() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/athlete/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            strengthNumbers: { lifts, tests, ratios: computedRatios },
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toastError("Save failed", data.error || "Please try again.");
          return;
        }

        success("Strength numbers saved");
        router.refresh();
      } catch {
        toastError("Save failed", "Network error. Please try again.");
      }
    });
  }

  /* ── Ratio helpers ──────────────────────────────────────────────────── */

  function getRatioValue(key: string): number {
    if (key === "backSquat") return computedRatios.squatBW;
    if (key === "powerClean") return computedRatios.cleanBW;
    return computedRatios.snatchBW;
  }

  function getRatioColor(value: number, target: number): "success" | "warning" | "danger" {
    if (value >= target) return "success";
    if (value >= target * 0.8) return "warning";
    return "danger";
  }

  function getRatioTextColor(value: number, target: number): string {
    if (value >= target) return "text-success-500";
    if (value >= target * 0.8) return "text-warning-500";
    return "text-danger-500";
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  const hasBW = !!profile.weightKg && profile.weightKg > 0;

  return (
    <div className="space-y-6">
      {/* ── Lift Cards ─────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 sm:p-6 space-y-5">
        <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">Lift Maxes</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LIFTS.map((lift) => {
            const entry = lifts[lift.key] ?? { ...defaultLift };
            return (
              <div key={lift.key} className="card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">{lift.label}</h3>

                {/* Current Max */}
                <div>
                  <label
                    htmlFor={`lift-${lift.key}-current`}
                    className="block text-sm font-medium text-[var(--foreground)] mb-1"
                  >
                    Current Max (kg)
                  </label>
                  <Input
                    id={`lift-${lift.key}-current`}
                    type="number"
                    step="0.5"
                    min="0"
                    className="w-full"
                    value={entry.current || ""}
                    onChange={(e) => updateLift(lift.key, "current", e.target.value)}
                    placeholder="0"
                  />
                </div>

                {/* Date Tested */}
                <div>
                  <label
                    htmlFor={`lift-${lift.key}-date`}
                    className="block text-sm font-medium text-[var(--foreground)] mb-1"
                  >
                    Date Tested
                  </label>
                  <input
                    id={`lift-${lift.key}-date`}
                    type="date"
                    className="input w-full"
                    value={entry.date}
                    onChange={(e) => updateLift(lift.key, "date", e.target.value)}
                  />
                </div>

                {/* Goal */}
                <div>
                  <label
                    htmlFor={`lift-${lift.key}-goal`}
                    className="block text-sm font-medium text-[var(--foreground)] mb-1"
                  >
                    Goal (kg)
                  </label>
                  <Input
                    id={`lift-${lift.key}-goal`}
                    type="number"
                    step="0.5"
                    min="0"
                    className="w-full"
                    value={entry.goal || ""}
                    onChange={(e) => updateLift(lift.key, "goal", e.target.value)}
                    placeholder="0"
                  />
                </div>

                {/* Correlation */}
                <div>
                  <label
                    htmlFor={`lift-${lift.key}-corr`}
                    className="block text-sm font-medium text-[var(--foreground)] mb-1"
                  >
                    Correlation
                  </label>
                  <select
                    id={`lift-${lift.key}-corr`}
                    className="input w-full"
                    value={entry.correlation}
                    onChange={(e) => updateLift(lift.key, "correlation", e.target.value)}
                  >
                    {CORRELATIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Athletic Tests ─────────────────────────────────────────────── */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 sm:p-6 space-y-5">
        <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">
          Athletic Tests
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="test-slj"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Standing Long Jump (mm)
            </label>
            <Input
              id="test-slj"
              type="number"
              step="1"
              min="0"
              className="w-full"
              value={tests.standingLJ || ""}
              onChange={(e) =>
                setTests((prev) => ({
                  ...prev,
                  standingLJ: parseFloat(e.target.value) || 0,
                }))
              }
              placeholder="0"
            />
          </div>
          <div>
            <label
              htmlFor="test-tj"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Triple Jump (m)
            </label>
            <Input
              id="test-tj"
              type="number"
              step="0.01"
              min="0"
              className="w-full"
              value={tests.tripleJump || ""}
              onChange={(e) =>
                setTests((prev) => ({
                  ...prev,
                  tripleJump: parseFloat(e.target.value) || 0,
                }))
              }
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* ── Strength-to-Bodyweight Ratios ──────────────────────────────── */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 sm:p-6 space-y-5">
        <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">
          Strength-to-Bodyweight Ratios
        </h2>

        {!hasBW ? (
          <div className="rounded-lg bg-surface-100 dark:bg-surface-800/50 p-4 text-center">
            <p className="text-sm text-muted">
              Set body weight in the{" "}
              <span className="font-semibold text-primary-500">Core Info</span> tab to see your
              ratios.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {RATIOS.map((ratio) => {
              const value = getRatioValue(ratio.key);
              const variant = getRatioColor(value, ratio.target);
              const textColor = getRatioTextColor(value, ratio.target);
              // Clamp progress to 100% for the bar
              const progressPct = Math.min((value / ratio.target) * 100, 100);

              return (
                <div key={ratio.key} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {ratio.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <NumberFlow
                        value={value}
                        decimals={2}
                        className={cn("text-sm font-semibold tabular-nums", textColor)}
                      />
                      <span className="text-xs text-muted">/ {ratio.target.toFixed(1)}x</span>
                    </div>
                  </div>

                  <ProgressBar value={progressPct} variant={variant} size="sm" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Save Button ────────────────────────────────────────────────── */}
      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
