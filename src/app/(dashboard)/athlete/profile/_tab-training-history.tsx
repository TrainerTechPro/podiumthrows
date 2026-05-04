"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components";
import { Input } from "@/components/ui/Input";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";
import { parseNumericInput } from "@/lib/forms/parse-numeric";
import type { ProfileData, TrainingHistoryData } from "./_types";
import { EVENTS_LIST } from "./_types";

const defaultData: TrainingHistoryData = {
  version: 1,
  yearsTraining: null,
  weeklyVolumeHours: null,
  priorCoaches: "",
  notableCompetitions: "",
  prePR: {},
};

export function TabTrainingHistory({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();

  const initial = profile.trainingHistory ?? defaultData;

  const [yearsTraining, setYearsTraining] = useState<number | null>(initial.yearsTraining);
  const [weeklyVolumeHours, setWeeklyVolumeHours] = useState<number | null>(
    initial.weeklyVolumeHours
  );
  const [priorCoaches, setPriorCoaches] = useState(initial.priorCoaches);
  const [notableCompetitions, setNotableCompetitions] = useState(initial.notableCompetitions);
  const [prePR, setPrePR] = useState<Record<string, number | null>>(() => ({ ...initial.prePR }));

  const athleteEvents = EVENTS_LIST.filter((ev) => profile.events.includes(ev.value));

  function setEventPR(event: string, value: number | null) {
    setPrePR((prev) => ({ ...prev, [event]: value }));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const payload: TrainingHistoryData = {
          version: 1,
          yearsTraining,
          weeklyVolumeHours,
          priorCoaches: priorCoaches.trim(),
          notableCompetitions: notableCompetitions.trim(),
          prePR,
        };

        const res = await fetch("/api/athlete/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ trainingHistory: payload }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          toastError("Save failed", data?.error || "Please try again.");
          return;
        }

        success("Training history saved");
        router.refresh();
      } catch (err) {
        logger.error("training history save failed", {
          context: "athlete/profile/tab-training-history",
          error: err,
        });
        toastError("Save failed", "Network error. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Background ──────────────────────────────────────────────── */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">
            Training Background
          </h2>
          <p className="text-sm text-muted mt-1">
            Years and weekly volume help your coach calibrate session loading.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="th-years"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Years training throws
            </label>
            <Input
              id="th-years"
              type="number"
              step="0.5"
              min="0"
              max="60"
              className="w-full"
              value={yearsTraining ?? ""}
              onChange={(e) => setYearsTraining(parseNumericInput(e.target.value))}
              placeholder="0"
            />
          </div>
          <div>
            <label
              htmlFor="th-volume"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Weekly volume (hours)
            </label>
            <Input
              id="th-volume"
              type="number"
              step="0.5"
              min="0"
              max="60"
              className="w-full"
              value={weeklyVolumeHours ?? ""}
              onChange={(e) => setWeeklyVolumeHours(parseNumericInput(e.target.value))}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* ── Pre-app PRs ─────────────────────────────────────────────── */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">
            Pre-app PRs
          </h2>
          <p className="text-sm text-muted mt-1">
            Best competition mark before tracking in Podium. New PRs auto-update from your throw log
            — these are just history.
          </p>
        </div>

        {athleteEvents.length === 0 ? (
          <p className="text-sm text-muted">
            Add events in <span className="font-semibold text-primary-500">Core Info</span> to log
            pre-app PRs.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {athleteEvents.map((ev) => (
              <div key={ev.value}>
                <label
                  htmlFor={`th-pr-${ev.value}`}
                  className="block text-sm font-medium text-[var(--foreground)] mb-1"
                >
                  {ev.label} (m)
                </label>
                <Input
                  id={`th-pr-${ev.value}`}
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full"
                  value={prePR[ev.value] ?? ""}
                  onChange={(e) => setEventPR(ev.value, parseNumericInput(e.target.value))}
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Coaching + competition history ──────────────────────────── */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 sm:p-6 space-y-5">
        <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">History</h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="th-prior-coaches"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Prior coaches
            </label>
            <textarea
              id="th-prior-coaches"
              className="input w-full min-h-[88px]"
              value={priorCoaches}
              onChange={(e) => setPriorCoaches(e.target.value)}
              placeholder="Names, programs, dates — anything that helps your current coach calibrate."
              maxLength={2000}
            />
          </div>

          <div>
            <label
              htmlFor="th-notable-comps"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Notable competitions
            </label>
            <textarea
              id="th-notable-comps"
              className="input w-full min-h-[88px]"
              value={notableCompetitions}
              onChange={(e) => setNotableCompetitions(e.target.value)}
              placeholder="Conference, regional, national meets — finishes and dates."
              maxLength={2000}
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
