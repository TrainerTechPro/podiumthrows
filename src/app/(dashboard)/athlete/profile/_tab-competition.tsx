"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import type {
  ProfileData,
  ThrowsProfileSummary,
  CompetitionGoalsEntry,
  CompetitionGoalsMap,
  CompetitionMark,
} from "./_types";

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const emptyMark = (): CompetitionMark => ({ distance: 0, date: "", meet: "" });

const emptyEntry = (): CompetitionGoalsEntry => ({
  competitionPR: emptyMark(),
  seasonBest: emptyMark(),
  seasonGoal: 0,
  careerGoal: 0,
  targetBand: "",
});

/* ─── Per-Event Form State ──────────────────────────────────────────────── */

type EventFormState = Record<string, CompetitionGoalsEntry>;

function buildInitialState(
  events: string[],
  goals: CompetitionGoalsMap | null
): EventFormState {
  const state: EventFormState = {};
  for (const ev of events) {
    const existing = goals?.[ev];
    state[ev] = existing
      ? {
          competitionPR: {
            distance: existing.competitionPR?.distance ?? 0,
            date: existing.competitionPR?.date ?? "",
            meet: existing.competitionPR?.meet ?? "",
          },
          seasonBest: {
            distance: existing.seasonBest?.distance ?? 0,
            date: existing.seasonBest?.date ?? "",
            meet: existing.seasonBest?.meet ?? "",
          },
          seasonGoal: existing.seasonGoal ?? 0,
          careerGoal: existing.careerGoal ?? 0,
          targetBand: existing.targetBand ?? "",
        }
      : emptyEntry();
  }
  return state;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

interface TabCompetitionProps {
  profile: ProfileData;
  throwsProfiles: ThrowsProfileSummary[];
}

export function TabCompetition({ profile, throwsProfiles }: TabCompetitionProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();

  const events = profile.events as string[];

  const [form, setForm] = useState<EventFormState>(() =>
    buildInitialState(events, profile.competitionGoals)
  );

  // Collapsible state: on mobile all start collapsed; track which are open
  const [openEvents, setOpenEvents] = useState<Set<string>>(new Set(events));

  const toggleEvent = (ev: string) => {
    setOpenEvents((prev) => {
      const next = new Set(prev);
      if (next.has(ev)) next.delete(ev);
      else next.add(ev);
      return next;
    });
  };

  /* ── Field updaters ──────────────────────────────────────────────── */

  const updateMark = (
    event: string,
    field: "competitionPR" | "seasonBest",
    key: keyof CompetitionMark,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [event]: {
        ...prev[event],
        [field]: {
          ...prev[event][field],
          [key]: key === "distance" ? parseFloat(value) || 0 : value,
        },
      },
    }));
  };

  const updateGoal = (
    event: string,
    field: "seasonGoal" | "careerGoal",
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [event]: {
        ...prev[event],
        [field]: parseFloat(value) || 0,
      },
    }));
  };

  const updateTargetBand = (event: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [event]: {
        ...prev[event],
        targetBand: value,
      },
    }));
  };

  /* ── Save ─────────────────────────────────────────────────────────── */

  const handleSave = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/athlete/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...csrfHeaders(),
          },
          body: JSON.stringify({ competitionGoals: form }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toastError("Save failed", data.error || "Please try again.");
          return;
        }

        success("Competition data saved");
        router.refresh();
      } catch {
        toastError("Save failed", "Network error. Please try again.");
      }
    });
  };

  /* ── No events message ───────────────────────────────────────────── */

  if (events.length === 0) {
    return (
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-8 text-center">
        <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">
          No Events Selected
        </h2>
        <p className="mt-2 text-sm text-muted">
          Add your events in the{" "}
          <span className="font-semibold text-primary-500">Core Info</span> tab
          to set up competition goals and distance bands.
        </p>
      </div>
    );
  }

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      {events.map((ev) => {
        const isOpen = openEvents.has(ev);
        const tp = throwsProfiles.find((p) => p.event === ev);
        const band = tp?.currentDistanceBand;
        const entry = form[ev] ?? emptyEntry();

        return (
          <div
            key={ev}
            className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] overflow-hidden"
          >
            {/* ── Collapsible header ─────────────────────────────── */}
            <button
              type="button"
              onClick={() => toggleEvent(ev)}
              className={cn(
                "card-interactive w-full flex items-center justify-between gap-3 px-5 py-4",
                "text-left"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-heading font-semibold text-[var(--foreground)]">
                  {formatEventName(ev)}
                </span>
                {band && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-500/15 text-primary-600 dark:text-primary-400 shrink-0">
                    {band}
                  </span>
                )}
              </div>
              <ChevronDown
                className={cn(
                  "w-5 h-5 shrink-0 text-muted transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </button>

            {/* ── Collapsible body ───────────────────────────────── */}
            {isOpen && (
              <div className="px-5 pb-5 space-y-5 border-t border-[var(--card-border)]">
                {/* Competition PR */}
                <MarkSection
                  label="Competition PR"
                  mark={entry.competitionPR}
                  onChange={(key, val) =>
                    updateMark(ev, "competitionPR", key, val)
                  }
                />

                {/* Season Best */}
                <MarkSection
                  label="Season Best"
                  mark={entry.seasonBest}
                  onChange={(key, val) =>
                    updateMark(ev, "seasonBest", key, val)
                  }
                />

                {/* Goals row */}
                <div>
                  <h4 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
                    Goals
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-[var(--foreground)] mb-1 block">
                        Season Goal (m)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input w-full"
                        value={entry.seasonGoal || ""}
                        onChange={(e) =>
                          updateGoal(ev, "seasonGoal", e.target.value)
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[var(--foreground)] mb-1 block">
                        Career Goal (m)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input w-full"
                        value={entry.careerGoal || ""}
                        onChange={(e) =>
                          updateGoal(ev, "careerGoal", e.target.value)
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Distance Bands */}
                <div>
                  <h4 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
                    Distance Bands
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-[var(--foreground)] mb-1 block">
                        Current Band
                      </label>
                      <div className="input w-full bg-surface-50 dark:bg-surface-800/50 text-muted cursor-not-allowed">
                        {band || "Not yet calculated"}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[var(--foreground)] mb-1 block">
                        Target Band
                      </label>
                      <input
                        type="text"
                        className="input w-full"
                        value={entry.targetBand}
                        onChange={(e) =>
                          updateTargetBand(ev, e.target.value)
                        }
                        placeholder="e.g. 18-19m"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Save button ───────────────────────────────────────────── */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="btn-primary px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

/* ─── Mark Section (PR / Season Best) ───────────────────────────────────── */

function MarkSection({
  label,
  mark,
  onChange,
}: {
  label: string;
  mark: CompetitionMark;
  onChange: (key: keyof CompetitionMark, value: string) => void;
}) {
  return (
    <div className="pt-4">
      <h4 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
        {label}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium text-[var(--foreground)] mb-1 block">
            Distance (m)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input w-full"
            value={mark.distance || ""}
            onChange={(e) => onChange("distance", e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--foreground)] mb-1 block">
            Date
          </label>
          <input
            type="date"
            className="input w-full"
            value={mark.date}
            onChange={(e) => onChange("date", e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--foreground)] mb-1 block">
            Meet Name
          </label>
          <input
            type="text"
            className="input w-full"
            value={mark.meet}
            onChange={(e) => onChange("meet", e.target.value)}
            placeholder="e.g. NCAA Regionals"
          />
        </div>
      </div>
    </div>
  );
}
