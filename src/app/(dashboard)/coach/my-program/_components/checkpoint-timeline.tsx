"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Checkpoint {
  id: string;
  weekNumber: number;
  complexNumber: number;
  recommendation: string;
  reasoning: string;
  markTrend: string;
  averageMark: number | null;
  peakMark: number | null;
  avgReadiness: number | null;
  applied: boolean;
  feedbackData: string | null;
  createdAt: string;
}

interface CheckpointTimelineProps {
  programId: string;
}

// ── Decision badge colors ────────────────────────────────────────────────────

const DECISION_STYLES: Record<string, { bg: string; text: string }> = {
  CONTINUE:       { bg: "bg-surface-200 dark:bg-surface-700", text: "text-surface-600 dark:text-surface-300" },
  DELOAD:         { bg: "bg-amber-100 dark:bg-amber-900/30",  text: "text-amber-700 dark:text-amber-400" },
  REDUCE_VOLUME:  { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400" },
  ROTATE_COMPLEX: { bg: "bg-blue-100 dark:bg-blue-900/30",    text: "text-blue-700 dark:text-blue-400" },
  ADVANCE_PHASE:  { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400" },
};

const DEFAULT_STYLE = { bg: "bg-surface-200 dark:bg-surface-700", text: "text-surface-600 dark:text-surface-300" };

// ── Relative time helper (no date library) ───────────────────────────────────

function formatRelative(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60)   return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)   return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24)     return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1)     return "1 day ago";
  if (days < 30)      return `${days} days ago`;

  const months = Math.floor(days / 30);
  if (months === 1)   return "1 month ago";
  return `${months} months ago`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CheckpointTimeline({ programId }: CheckpointTimelineProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchCheckpoints = useCallback(
    (signal?: AbortSignal) => {
      setError(false);
      setLoading(true);

      fetch(`/api/throws/program/${programId}/adapt/history?limit=20`, { signal })
        .then((res) => {
          if (!res.ok) throw new Error("fetch failed");
          return res.json();
        })
        .then((json) => {
          const list = json?.data?.checkpoints;
          if (Array.isArray(list)) {
            setCheckpoints(list);
          } else {
            setCheckpoints([]);
          }
        })
        .catch((err) => {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            setError(true);
          }
        })
        .finally(() => setLoading(false));
    },
    [programId],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchCheckpoints(controller.signal);
    return () => controller.abort();
  }, [fetchCheckpoints]);

  // ── Loading skeleton ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-4 w-16 bg-[var(--muted-bg)] rounded" />
              <div className="h-5 w-24 bg-[var(--muted-bg)] rounded-full" />
              <div className="flex-1" />
              <div className="h-3 w-20 bg-[var(--muted-bg)] rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="card p-8 text-center space-y-3">
        <p className="text-sm text-red-500 dark:text-red-400">
          Failed to load adaptation checkpoints.
        </p>
        <button
          onClick={() => fetchCheckpoints()}
          className="btn-secondary text-xs px-4 py-1.5"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────

  if (checkpoints.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-muted">
          No adaptation checkpoints yet — checkpoints are written at the end of each training week.
        </p>
      </div>
    );
  }

  // ── Timeline rows ────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      {checkpoints.map((cp) => {
        const style = DECISION_STYLES[cp.recommendation] ?? DEFAULT_STYLE;
        const isExpanded = expandedId === cp.id;
        let parsedFeedback: string | null = null;

        if (isExpanded && cp.feedbackData) {
          try {
            parsedFeedback = JSON.stringify(JSON.parse(cp.feedbackData), null, 2);
          } catch {
            parsedFeedback = cp.feedbackData;
          }
        }

        return (
          <button
            key={cp.id}
            type="button"
            onClick={() => setExpandedId(isExpanded ? null : cp.id)}
            aria-expanded={isExpanded}
            className="card w-full text-left transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/60"
          >
            <div className="flex items-center gap-3 p-4">
              {/* Week number */}
              <span className="text-xs font-semibold text-[var(--foreground)] w-16 shrink-0 tabular-nums">
                Week {cp.weekNumber}
              </span>

              {/* Decision badge */}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${style.bg} ${style.text}`}
              >
                {cp.recommendation.replace(/_/g, " ")}
              </span>

              {/* Applied dot */}
              <span
                className="shrink-0"
                title={cp.applied ? "Applied" : "Pending application"}
              >
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    cp.applied
                      ? "bg-emerald-500"
                      : "border border-surface-400 dark:border-surface-500"
                  }`}
                />
              </span>

              <span className="flex-1" />

              {/* Relative time */}
              <span className="text-[11px] text-muted shrink-0 tabular-nums">
                {formatRelative(cp.createdAt)}
              </span>

              {/* Expand chevron */}
              <svg
                className={`w-3.5 h-3.5 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-0 space-y-2 border-t border-[var(--card-border)]">
                <p className="text-xs text-[var(--foreground)] leading-relaxed pt-3">
                  {cp.reasoning}
                </p>
                {parsedFeedback && (
                  <pre className="text-[11px] text-muted bg-[var(--muted-bg)] rounded-lg p-3 overflow-x-auto font-mono leading-relaxed">
                    {parsedFeedback}
                  </pre>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
