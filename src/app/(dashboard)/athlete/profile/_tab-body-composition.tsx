"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components";
import { Input } from "@/components/ui/Input";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";
import { localToday } from "@/lib/utils";
import { parseNumericInput } from "@/lib/forms/parse-numeric";
import type { BodyCompositionData, ProfileData } from "./_types";

const defaultData: BodyCompositionData = {
  version: 1,
  measuredAt: null,
  bodyFatPct: null,
  chestCm: null,
  bicepsCm: null,
  thighCm: null,
  calfCm: null,
};

export function TabBodyComposition({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();

  const initial = profile.bodyComposition ?? defaultData;

  const [measuredAt, setMeasuredAt] = useState(initial.measuredAt ?? "");
  const [bodyFatPct, setBodyFatPct] = useState<number | null>(initial.bodyFatPct);
  const [chestCm, setChestCm] = useState<number | null>(initial.chestCm);
  const [bicepsCm, setBicepsCm] = useState<number | null>(initial.bicepsCm);
  const [thighCm, setThighCm] = useState<number | null>(initial.thighCm);
  const [calfCm, setCalfCm] = useState<number | null>(initial.calfCm);

  function handleSave() {
    startTransition(async () => {
      try {
        const payload: BodyCompositionData = {
          version: 1,
          measuredAt: measuredAt || null,
          bodyFatPct,
          chestCm,
          bicepsCm,
          thighCm,
          calfCm,
        };

        const res = await fetch("/api/athlete/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ bodyComposition: payload }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          toastError("Save failed", data?.error || "Please try again.");
          return;
        }

        success("Body composition saved");
        router.refresh();
      } catch (err) {
        logger.error("body composition save failed", {
          context: "athlete/profile/tab-body-composition",
          error: err,
        });
        toastError("Save failed", "Network error. Please try again.");
      }
    });
  }

  const today = localToday();

  return (
    <div className="space-y-6">
      {/* ── Measurement date ────────────────────────────────────────── */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">
            Measurements
          </h2>
          <p className="text-sm text-muted mt-1">
            Tape-measure circumferences and body fat. Update when you reassess — measurements decay
            fast.
          </p>
        </div>

        <div>
          <label
            htmlFor="bc-date"
            className="block text-sm font-medium text-[var(--foreground)] mb-1"
          >
            Date measured
          </label>
          <input
            id="bc-date"
            type="date"
            className="input w-full max-w-xs"
            max={today}
            value={measuredAt}
            onChange={(e) => setMeasuredAt(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="bc-bf"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Body fat (%)
            </label>
            <Input
              id="bc-bf"
              type="number"
              step="0.1"
              min="0"
              max="60"
              className="w-full"
              value={bodyFatPct ?? ""}
              onChange={(e) => setBodyFatPct(parseNumericInput(e.target.value))}
              placeholder="0.0"
            />
          </div>

          <div>
            <label
              htmlFor="bc-chest"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Chest (cm)
            </label>
            <Input
              id="bc-chest"
              type="number"
              step="0.5"
              min="0"
              max="200"
              className="w-full"
              value={chestCm ?? ""}
              onChange={(e) => setChestCm(parseNumericInput(e.target.value))}
              placeholder="0"
            />
          </div>

          <div>
            <label
              htmlFor="bc-biceps"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Biceps (cm)
            </label>
            <Input
              id="bc-biceps"
              type="number"
              step="0.5"
              min="0"
              max="80"
              className="w-full"
              value={bicepsCm ?? ""}
              onChange={(e) => setBicepsCm(parseNumericInput(e.target.value))}
              placeholder="0"
            />
          </div>

          <div>
            <label
              htmlFor="bc-thigh"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Thigh (cm)
            </label>
            <Input
              id="bc-thigh"
              type="number"
              step="0.5"
              min="0"
              max="120"
              className="w-full"
              value={thighCm ?? ""}
              onChange={(e) => setThighCm(parseNumericInput(e.target.value))}
              placeholder="0"
            />
          </div>

          <div>
            <label
              htmlFor="bc-calf"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Calf (cm)
            </label>
            <Input
              id="bc-calf"
              type="number"
              step="0.5"
              min="0"
              max="80"
              className="w-full"
              value={calfCm ?? ""}
              onChange={(e) => setCalfCm(parseNumericInput(e.target.value))}
              placeholder="0"
            />
          </div>
        </div>
      </div>

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
