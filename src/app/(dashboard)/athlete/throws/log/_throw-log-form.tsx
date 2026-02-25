"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components";
import { IMPLEMENT_PRESETS, VALID_EVENTS } from "@/lib/throws";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function ThrowLogForm({
  gender,
  athleteEvents,
}: {
  gender: "male" | "female";
  athleteEvents: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [event, setEvent] = useState<string>(athleteEvents[0] ?? "SHOT_PUT");
  const [implementKg, setImplementKg] = useState<string>("");
  const [distance, setDistance] = useState<string>("");
  const [isCompetition, setIsCompetition] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [showOptional, setShowOptional] = useState(false);

  // Feedback state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    distance: number;
    event: string;
    implementWeight: number;
    isPersonalBest: boolean;
  } | null>(null);

  // Derive presets for current event
  const presets = IMPLEMENT_PRESETS[event]?.[gender] ?? [];

  function resetForAnother() {
    // Keep event and implement pre-filled for rapid entry
    setDistance("");
    setRpe(null);
    setNotes("");
    setIsCompetition(false);
    setShowOptional(false);
    setSuccess(null);
    setError(null);
  }

  async function handleSubmit() {
    setError(null);

    const distNum = parseFloat(distance);
    const implNum = parseFloat(implementKg);

    if (!event || !VALID_EVENTS.includes(event as never)) {
      setError("Please select an event.");
      return;
    }
    if (isNaN(implNum) || implNum <= 0) {
      setError("Please enter a valid implement weight.");
      return;
    }
    if (isNaN(distNum) || distNum <= 0) {
      setError("Please enter a valid distance.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/athlete/throws", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event,
            implementKg: implNum,
            distance: distNum,
            isCompetition,
            rpe: rpe ?? undefined,
            notes: notes.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Something went wrong.");
          return;
        }

        const data = await res.json();
        setSuccess({
          distance: distNum,
          event,
          implementWeight: implNum,
          isPersonalBest: data.isPersonalBest,
        });

        router.refresh();
      } catch {
        setError("Failed to log throw. Please try again.");
      }
    });
  }

  // ── Success state ──
  if (success) {
    return (
      <div className="card overflow-hidden animate-[fadeIn_300ms_ease]">
        {success.isPersonalBest ? (
          <div className="px-5 py-6 bg-amber-500/10 border-b border-amber-500/20 text-center">
            <div className="text-4xl mb-2">🏆</div>
            <h3 className="text-lg font-bold text-amber-600 dark:text-amber-400">
              New Personal Best!
            </h3>
            <p className="text-3xl font-bold tabular-nums text-[var(--foreground)] mt-2">
              {success.distance.toFixed(2)}m
            </p>
            <p className="text-sm text-muted mt-1">
              {formatEventName(success.event)} · {success.implementWeight}kg
            </p>
          </div>
        ) : (
          <div className="px-5 py-6 bg-emerald-500/10 border-b border-emerald-500/20 text-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto text-emerald-500 mb-2"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <h3 className="font-bold text-emerald-700 dark:text-emerald-400">
              Throw Logged
            </h3>
            <p className="text-2xl font-bold tabular-nums text-[var(--foreground)] mt-2">
              {success.distance.toFixed(2)}m
            </p>
            <p className="text-sm text-muted mt-1">
              {formatEventName(success.event)} · {success.implementWeight}kg
            </p>
          </div>
        )}

        <div className="p-5 flex gap-3">
          <button
            onClick={resetForAnother}
            className="btn btn-primary flex-1"
          >
            Log Another
          </button>
          <button
            onClick={() => router.push("/athlete/throws")}
            className="btn btn-secondary flex-1"
          >
            View History
          </button>
        </div>
      </div>
    );
  }

  // ── Form state ──
  return (
    <div className="card p-5 space-y-5">
      {/* Event */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Event
        </label>
        <div className="flex gap-2 flex-wrap">
          {(VALID_EVENTS as readonly string[]).map((ev) => (
            <button
              key={ev}
              type="button"
              onClick={() => {
                setEvent(ev);
                setImplementKg(""); // Reset implement when event changes
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                event === ev
                  ? "bg-primary-500 text-white"
                  : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]"
              }`}
            >
              {formatEventName(ev)}
            </button>
          ))}
        </div>
      </div>

      {/* Implement Weight */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Implement Weight (kg)
        </label>
        {presets.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-2">
            {presets.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setImplementKg(String(w))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium tabular-nums transition-colors ${
                  implementKg === String(w)
                    ? "bg-primary-500 text-white"
                    : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]"
                }`}
              >
                {w}kg
              </button>
            ))}
          </div>
        )}
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Enter weight in kg"
          value={implementKg}
          onChange={(e) => setImplementKg(e.target.value)}
          className="input w-full"
        />
      </div>

      {/* Distance */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Distance (meters)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="e.g., 18.45"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          className="input w-full text-lg font-semibold tabular-nums"
        />
      </div>

      {/* Optional fields toggle */}
      <button
        type="button"
        onClick={() => setShowOptional(!showOptional)}
        className="text-sm text-primary-500 hover:text-primary-600 transition-colors flex items-center gap-1"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${showOptional ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {showOptional ? "Hide" : "Show"} optional fields
      </button>

      {showOptional && (
        <div className="space-y-4 pl-1 border-l-2 border-[var(--card-border)] ml-1 pl-4">
          {/* Competition toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isCompetition}
              onChange={(e) => setIsCompetition(e.target.checked)}
              className="w-4 h-4 accent-primary-500 rounded"
            />
            <div>
              <span className="text-sm font-medium text-[var(--foreground)]">
                Competition Throw
              </span>
              <p className="text-xs text-muted">Mark this as a competition result</p>
            </div>
          </label>

          {/* RPE */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[var(--foreground)]">
                RPE <span className="text-muted font-normal">(optional)</span>
              </label>
              {rpe != null && (
                <span className="text-sm font-bold tabular-nums text-primary-500">
                  {rpe.toFixed(1)}
                </span>
              )}
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={rpe ?? 5}
              onChange={(e) => setRpe(parseFloat(e.target.value))}
              className="w-full accent-primary-500"
            />
            <div className="flex justify-between text-[10px] text-muted mt-1">
              <span>Easy (1)</span>
              <span>Moderate (5)</span>
              <span>Max (10)</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Notes <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Wind conditions, technique notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input w-full resize-none"
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="btn btn-primary w-full"
      >
        {isPending ? "Logging…" : "Log Throw"}
      </button>
    </div>
  );
}
