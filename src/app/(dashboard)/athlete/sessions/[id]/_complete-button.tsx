"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CompletionSummary, type SessionSummary } from "./_completion-summary";
import { csrfHeaders } from "@/lib/csrf-client";

export function CompleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [rpe, setRpe] = useState<number>(7);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ data: SessionSummary; rpe: number | null } | null>(null);

  async function handleComplete() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/athlete/sessions/${sessionId}/complete`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ rpe, notes: notes.trim() || undefined }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Something went wrong.");
          return;
        }

        const data = await res.json();

        // Show summary if available
        if (data.summary) {
          setSummary({ data: data.summary, rpe: data.rpe });
          setShowForm(false);
        }

        router.refresh();
      } catch {
        setError("Failed to complete session. Please try again.");
      }
    });
  }

  // Show summary after completion
  if (summary) {
    return <CompletionSummary summary={summary.data} rpe={summary.rpe} />;
  }

  if (showForm) {
    return (
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Complete Session</h3>

        {/* RPE slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[var(--foreground)]">
              Session RPE
            </label>
            <span className="text-sm font-bold tabular-nums text-primary-500">{rpe.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={rpe}
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
            placeholder="How did the session feel?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input w-full resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="btn btn-secondary flex-1"
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            onClick={handleComplete}
            disabled={isPending}
            className="btn btn-primary flex-1"
          >
            {isPending ? "Saving\u2026" : "Mark Complete"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowForm(true)}
      className="btn btn-primary w-full"
    >
      Mark Session Complete
    </button>
  );
}
