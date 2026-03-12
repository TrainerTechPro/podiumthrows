"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

type AutoregMode = "OFF" | "NOTIFY" | "AUTO" | "APPROVAL_REQUIRED";

interface TimescaleConfig {
  intraSession: boolean;
  sessionToSession: boolean;
  weekToWeek: boolean;
  blockToBlock: boolean;
  programToProgram: boolean;
}

interface CoachSelfSettings {
  mode: AutoregMode;
  timescales: TimescaleConfig;
}

interface AthleteSettings {
  athleteId: string;
  firstName: string;
  lastName: string;
  mode: AutoregMode | null; // null = inherit from coach
  timescales: TimescaleConfig;
}

const DEFAULT_TIMESCALES: TimescaleConfig = {
  intraSession: true,
  sessionToSession: true,
  weekToWeek: true,
  blockToBlock: true,
  programToProgram: true,
};

const MODE_OPTIONS: { value: AutoregMode; label: string; description: string }[] = [
  { value: "OFF", label: "Off", description: "No suggestions generated" },
  { value: "NOTIFY", label: "Notify", description: "Flag suggestions, you decide" },
  { value: "AUTO", label: "Auto", description: "Apply silently and notify" },
  { value: "APPROVAL_REQUIRED", label: "Approval", description: "Nothing applies without your explicit action" },
];

const TIMESCALE_LABELS: { key: keyof TimescaleConfig; label: string }[] = [
  { key: "intraSession", label: "Intra-session" },
  { key: "sessionToSession", label: "Session \u2192 Session" },
  { key: "weekToWeek", label: "Week to Week" },
  { key: "blockToBlock", label: "Block Transition" },
  { key: "programToProgram", label: "Program Complete" },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function AutoregulationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Coach self
  const [coachSelf, setCoachSelf] = useState<CoachSelfSettings>({
    mode: "NOTIFY",
    timescales: { ...DEFAULT_TIMESCALES },
  });
  const [coachSelfInitial, setCoachSelfInitial] = useState<CoachSelfSettings>({
    mode: "NOTIFY",
    timescales: { ...DEFAULT_TIMESCALES },
  });

  // Athletes
  const [athletes, setAthletes] = useState<AthleteSettings[]>([]);
  const [athletesInitial, setAthletesInitial] = useState<AthleteSettings[]>([]);

  // Save states per section
  const [coachSaving, setCoachSaving] = useState(false);
  const [coachSaveStatus, setCoachSaveStatus] = useState<"saved" | "error" | null>(null);
  const [athletesSaving, setAthletesSaving] = useState(false);
  const [athletesSaveStatus, setAthletesSaveStatus] = useState<"saved" | "error" | null>(null);

  // Expand state for athlete timescale toggles
  const [expandedAthletes, setExpandedAthletes] = useState<Set<string>>(new Set());

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchSettings = useCallback((signal?: AbortSignal) => {
    setError(false);
    setLoading(true);

    fetch("/api/coach/autoregulation-settings", { signal })
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((json) => {
        const data = json?.data;
        if (!data) throw new Error("invalid response");

        const cs: CoachSelfSettings = {
          mode: data.coachSelf?.mode ?? "NOTIFY",
          timescales: {
            ...DEFAULT_TIMESCALES,
            ...(data.coachSelf?.timescales ?? {}),
          },
        };
        setCoachSelf(cs);
        setCoachSelfInitial(structuredClone(cs));

        const aths: AthleteSettings[] = (data.athletes ?? []).map(
          (a: Record<string, unknown>) => ({
            athleteId: a.athleteId as string,
            firstName: a.firstName as string,
            lastName: a.lastName as string,
            mode: (a.mode as AutoregMode | null) ?? null,
            timescales: {
              ...DEFAULT_TIMESCALES,
              ...((a.timescales as Partial<TimescaleConfig>) ?? {}),
            },
          }),
        );
        setAthletes(aths);
        setAthletesInitial(structuredClone(aths));
      })
      .catch((err) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchSettings(controller.signal);
    return () => controller.abort();
  }, [fetchSettings]);

  // ── Dirty tracking ─────────────────────────────────────────────────────────

  const isCoachDirty = JSON.stringify(coachSelf) !== JSON.stringify(coachSelfInitial);
  const isAthletesDirty = JSON.stringify(athletes) !== JSON.stringify(athletesInitial);

  // ── Save handlers ──────────────────────────────────────────────────────────

  async function saveCoachSelf() {
    setCoachSaving(true);
    setCoachSaveStatus(null);
    try {
      const res = await fetch("/api/coach/autoregulation-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "COACH_SELF", ...coachSelf }),
      });
      if (!res.ok) throw new Error("save failed");
      setCoachSelfInitial(structuredClone(coachSelf));
      setCoachSaveStatus("saved");
      setTimeout(() => setCoachSaveStatus(null), 2000);
    } catch {
      setCoachSaveStatus("error");
    } finally {
      setCoachSaving(false);
    }
  }

  async function saveAthletes() {
    setAthletesSaving(true);
    setAthletesSaveStatus(null);
    try {
      const res = await fetch("/api/coach/autoregulation-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "ATHLETES",
          athletes: athletes.map((a) => ({
            athleteId: a.athleteId,
            mode: a.mode,
            timescales: a.timescales,
          })),
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setAthletesInitial(structuredClone(athletes));
      setAthletesSaveStatus("saved");
      setTimeout(() => setAthletesSaveStatus(null), 2000);
    } catch {
      setAthletesSaveStatus("error");
    } finally {
      setAthletesSaving(false);
    }
  }

  async function resetAthleteToDefault(athleteId: string) {
    // TODO: If backend doesn't support mode: null for deletion, send mode: 'INHERIT'
    try {
      await fetch("/api/coach/autoregulation-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "ATHLETE", athleteId, mode: null }),
      });
      setAthletes((prev) =>
        prev.map((a) =>
          a.athleteId === athleteId
            ? { ...a, mode: null, timescales: { ...DEFAULT_TIMESCALES } }
            : a,
        ),
      );
      setAthletesInitial((prev) =>
        prev.map((a) =>
          a.athleteId === athleteId
            ? { ...a, mode: null, timescales: { ...DEFAULT_TIMESCALES } }
            : a,
        ),
      );
    } catch {
      // Silently fail — user can retry
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-2xl animate-spring-up">
        <div className="mb-8">
          <div className="skeleton h-4 w-20 mb-4" />
          <div className="skeleton h-7 w-56 mb-2" />
          <div className="skeleton h-4 w-80" />
        </div>
        <div className="card p-6 space-y-4 mb-6">
          <div className="skeleton h-5 w-32 mb-3" />
          <div className="skeleton h-10 w-full rounded-lg" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-4 w-28" />
                <div className="flex-1" />
                <div className="skeleton h-5 w-10 rounded-full" />
              </div>
            ))}
          </div>
          <div className="skeleton h-10 w-20 rounded-xl" />
        </div>
        <div className="card p-6 space-y-4">
          <div className="skeleton h-5 w-40 mb-3" />
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton h-4 w-32" />
              <div className="flex-1" />
              <div className="skeleton h-8 w-48 rounded-lg" />
            </div>
          ))}
          <div className="skeleton h-10 w-20 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="max-w-2xl">
        <div className="card p-8 text-center space-y-3">
          <p className="text-sm text-red-500 dark:text-red-400">
            Failed to load autoregulation settings.
          </p>
          <button
            onClick={() => fetchSettings()}
            className="btn-secondary text-xs px-4 py-1.5"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl animate-spring-up">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/coach/settings"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-[var(--foreground)] transition-colors mb-4"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Settings
        </Link>
        <h1 className="text-2xl font-bold font-heading text-[var(--color-text)]">
          Autoregulation Settings
        </h1>
        <p className="text-[var(--color-text-2)] mt-1">
          Control how the adaptation engine surfaces suggestions and applies changes.
        </p>
      </div>

      {/* Section 1: Coach Self */}
      <div className="card mb-6">
        <div className="p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Your Training</h2>
            <p className="text-xs text-muted mt-0.5">
              Applied when you are both coach and athlete on a program.
            </p>
          </div>

          {/* Mode selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--foreground)]">Mode</label>
            <ModeSelector
              value={coachSelf.mode}
              onChange={(mode) => setCoachSelf((prev) => ({ ...prev, mode }))}
            />
          </div>

          {/* Timescale toggles */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--foreground)]">Timescales</label>
            <TimescaleToggles
              values={coachSelf.timescales}
              onChange={(timescales) => setCoachSelf((prev) => ({ ...prev, timescales }))}
            />
          </div>

          {/* Save row */}
          <SaveRow
            isDirty={isCoachDirty}
            saving={coachSaving}
            status={coachSaveStatus}
            onSave={saveCoachSelf}
          />
        </div>
      </div>

      {/* Section 2: Athletes */}
      <div className="card mb-6">
        <div className="p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Athlete Overrides</h2>
            <p className="text-xs text-muted mt-0.5">
              Per-athlete settings override the coach default.
            </p>
          </div>

          {athletes.length === 0 ? (
            <p className="text-sm text-muted py-2">
              No athletes on active programs.
            </p>
          ) : (
            <div className="space-y-4">
              {athletes.map((athlete) => {
                const isExpanded = expandedAthletes.has(athlete.athleteId);
                return (
                  <div
                    key={athlete.athleteId}
                    className="border border-[var(--card-border)] rounded-lg p-4 space-y-3"
                  >
                    {/* Athlete header */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium text-[var(--foreground)]">
                        {athlete.firstName} {athlete.lastName}
                      </span>
                      {athlete.mode === null && (
                        <span className="text-[11px] text-muted italic">Using coach default</span>
                      )}
                      <span className="flex-1" />
                      {athlete.mode !== null && (
                        <button
                          type="button"
                          onClick={() => resetAthleteToDefault(athlete.athleteId)}
                          className="text-[11px] text-muted hover:text-[var(--foreground)] transition-colors"
                        >
                          Use coach default
                        </button>
                      )}
                    </div>

                    {/* Compact mode selector */}
                    <ModeSelector
                      value={athlete.mode ?? coachSelf.mode}
                      onChange={(mode) => {
                        setAthletes((prev) =>
                          prev.map((a) =>
                            a.athleteId === athlete.athleteId ? { ...a, mode } : a,
                          ),
                        );
                      }}
                      compact
                    />

                    {/* Timescale expand toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedAthletes((prev) => {
                          const next = new Set(prev);
                          if (next.has(athlete.athleteId)) next.delete(athlete.athleteId);
                          else next.add(athlete.athleteId);
                          return next;
                        });
                      }}
                      className="text-[11px] text-muted hover:text-[var(--foreground)] transition-colors flex items-center gap-1"
                    >
                      <svg
                        className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      {isExpanded ? "Hide timescales" : "Show timescales"}
                    </button>

                    {isExpanded && (
                      <TimescaleToggles
                        values={athlete.timescales}
                        onChange={(timescales) => {
                          setAthletes((prev) =>
                            prev.map((a) =>
                              a.athleteId === athlete.athleteId ? { ...a, timescales } : a,
                            ),
                          );
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Save row */}
          {athletes.length > 0 && (
            <SaveRow
              isDirty={isAthletesDirty}
              saving={athletesSaving}
              status={athletesSaveStatus}
              onSave={saveAthletes}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared Subcomponents ─────────────────────────────────────────────────────

function ModeSelector({
  value,
  onChange,
  compact,
}: {
  value: AutoregMode;
  onChange: (mode: AutoregMode) => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid ${compact ? "grid-cols-4 gap-1" : "grid-cols-2 sm:grid-cols-4 gap-1.5"}`}>
      {MODE_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`text-left rounded-lg border transition-colors ${
              compact ? "px-2 py-1.5" : "px-3 py-2.5"
            } ${
              isActive
                ? "border-amber-500/60 bg-amber-50 dark:bg-amber-900/20 text-[var(--foreground)]"
                : "border-[var(--card-border)] hover:border-surface-400 dark:hover:border-surface-500 text-muted"
            }`}
          >
            <span className={`block font-medium ${compact ? "text-[11px]" : "text-xs"}`}>
              {opt.label}
            </span>
            {!compact && (
              <span className="block text-[11px] text-muted mt-0.5 leading-snug">
                {opt.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TimescaleToggles({
  values,
  onChange,
}: {
  values: TimescaleConfig;
  onChange: (next: TimescaleConfig) => void;
}) {
  return (
    <div className="space-y-1.5">
      {TIMESCALE_LABELS.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between py-1.5">
          <span className="text-xs text-[var(--foreground)]">{label}</span>
          <button
            type="button"
            role="switch"
            aria-checked={values[key]}
            onClick={() => onChange({ ...values, [key]: !values[key] })}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
              values[key]
                ? "bg-amber-500"
                : "bg-surface-300 dark:bg-surface-600"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform mt-0.5 ${
                values[key] ? "translate-x-[18px] ml-0.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  );
}

function SaveRow({
  isDirty,
  saving,
  status,
  onSave,
}: {
  isDirty: boolean;
  saving: boolean;
  status: "saved" | "error" | null;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button
        type="button"
        onClick={onSave}
        disabled={saving || !isDirty}
        className="btn btn-primary disabled:opacity-50"
      >
        {saving ? "Saving\u2026" : "Save"}
      </button>

      {isDirty && !saving && status === null && (
        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
          Unsaved changes
        </span>
      )}

      {status === "saved" && (
        <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
          Saved
        </span>
      )}

      {status === "error" && (
        <span className="text-sm text-red-500 dark:text-red-400">
          Save failed — try again
        </span>
      )}
    </div>
  );
}
