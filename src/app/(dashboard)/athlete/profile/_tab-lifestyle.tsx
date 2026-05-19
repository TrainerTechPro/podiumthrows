"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components";
import { Input } from "@/components/ui/Input";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";
import { parseNumericInput } from "@/lib/forms/parse-numeric";
import type { LifestyleData, ProfileData } from "./_types";
import { RECOVERY_PRACTICE_OPTIONS } from "./_types";

const defaultData: LifestyleData = {
  version: 1,
  sleepHours: null,
  schoolWorkHours: null,
  stressBaseline: null,
  nutritionSetup: "",
  recoveryPractices: [],
};

export function TabLifestyle({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();

  const initial = profile.lifestyle ?? defaultData;

  const [sleepHours, setSleepHours] = useState<number | null>(initial.sleepHours);
  const [schoolWorkHours, setSchoolWorkHours] = useState<number | null>(initial.schoolWorkHours);
  const [stressBaseline, setStressBaseline] = useState<number | null>(initial.stressBaseline);
  const [nutritionSetup, setNutritionSetup] = useState(initial.nutritionSetup);
  const [recoveryPractices, setRecoveryPractices] = useState<string[]>([
    ...initial.recoveryPractices,
  ]);

  function togglePractice(key: string) {
    setRecoveryPractices((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const payload: LifestyleData = {
          version: 1,
          sleepHours,
          schoolWorkHours,
          stressBaseline,
          nutritionSetup: nutritionSetup.trim(),
          recoveryPractices,
        };

        const res = await fetch("/api/athlete/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ lifestyle: payload }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          toastError("Save failed", data?.error || "Please try again.");
          return;
        }

        success("Lifestyle saved");
        router.refresh();
      } catch (err) {
        logger.error("lifestyle save failed", {
          context: "athlete/profile/tab-lifestyle",
          error: err,
        });
        toastError("Save failed", "Network error. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Sleep + load ────────────────────────────────────────────── */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">
            Sleep &amp; daily load
          </h2>
          <p className="text-sm text-muted mt-1">
            Typical numbers, not yesterday&apos;s. Used to calibrate readiness expectations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="ls-sleep"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Sleep (hours / night)
            </label>
            <Input
              id="ls-sleep"
              type="number"
              step="0.5"
              min="0"
              max="14"
              className="w-full"
              value={sleepHours ?? ""}
              onChange={(e) => setSleepHours(parseNumericInput(e.target.value))}
              placeholder="0"
            />
          </div>
          <div>
            <label
              htmlFor="ls-school-work"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              School / work (hours / day)
            </label>
            <Input
              id="ls-school-work"
              type="number"
              step="0.5"
              min="0"
              max="24"
              className="w-full"
              value={schoolWorkHours ?? ""}
              onChange={(e) => setSchoolWorkHours(parseNumericInput(e.target.value))}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* ── Stress baseline ─────────────────────────────────────────── */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">
            Stress baseline
          </h2>
          <p className="text-sm text-muted mt-1">
            Your typical day, 1 (calm) to 10 (overloaded). This is the reference point your
            check-ins compare against.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const active = stressBaseline === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setStressBaseline(active ? null : n)}
                aria-pressed={active}
                className={cn(
                  "w-10 h-10 rounded-lg text-sm font-medium border transition-colors tabular-nums",
                  active
                    ? "border-primary-500 bg-primary-500/8 text-primary-700 dark:text-primary-300"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] text-muted hover:text-[var(--foreground)]"
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Nutrition ───────────────────────────────────────────────── */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 sm:p-6 space-y-5">
        <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">Nutrition</h2>

        <div>
          <label
            htmlFor="ls-nutrition"
            className="block text-sm font-medium text-[var(--foreground)] mb-1"
          >
            Setup
          </label>
          <textarea
            id="ls-nutrition"
            className="input w-full min-h-[88px]"
            value={nutritionSetup}
            onChange={(e) => setNutritionSetup(e.target.value)}
            placeholder="Dining hall / self-prep / meal plan / dietitian — anything your coach should know."
            maxLength={2000}
          />
        </div>
      </div>

      {/* ── Recovery practices ─────────────────────────────────────── */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">
            Recovery practices
          </h2>
          <p className="text-sm text-muted mt-1">
            What you regularly use, not what&apos;s available.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {RECOVERY_PRACTICE_OPTIONS.map((opt) => {
            const active = recoveryPractices.includes(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => togglePractice(opt.key)}
                aria-pressed={active}
                className={cn(
                  "px-4 py-3 rounded-lg text-sm font-medium border transition-colors text-left",
                  active
                    ? "border-primary-500 bg-primary-500/8 text-primary-700 dark:text-primary-300"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] text-muted hover:text-[var(--foreground)]"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          {isPending ? "Saving changes…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
