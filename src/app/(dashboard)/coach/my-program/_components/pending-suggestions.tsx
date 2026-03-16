"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

// ── Types ────────────────────────────────────────────────────────────────────

interface Suggestion {
  id: string;
  programId: string;
  timescale: string;
  status: string;
  suggestedChange: string;
  reasoning: string;
  expiresAt: string;
  autoApproveAt: string | null;
  createdAt: string;
}

interface PendingSuggestionsProps {
  programId: string;
}

// ── Timescale labels + badge colors ──────────────────────────────────────────

const TIMESCALE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  INTRA_SESSION:      { label: "Intra-session",      bg: "bg-surface-200 dark:bg-surface-700",   text: "text-surface-600 dark:text-surface-300" },
  SESSION_TO_SESSION: { label: "Session \u2192 Session", bg: "bg-surface-200 dark:bg-surface-700",   text: "text-surface-600 dark:text-surface-300" },
  WEEK_TO_WEEK:       { label: "Week to Week",        bg: "bg-amber-100 dark:bg-amber-900/30",    text: "text-amber-700 dark:text-amber-400" },
  BLOCK_TO_BLOCK:     { label: "Block Transition",    bg: "bg-blue-100 dark:bg-blue-900/30",      text: "text-blue-700 dark:text-blue-400" },
  PROGRAM_TO_PROGRAM: { label: "Program Complete",    bg: "bg-blue-100 dark:bg-blue-900/30",      text: "text-blue-700 dark:text-blue-400" },
};

const DEFAULT_TIMESCALE = { label: "Unknown", bg: "bg-surface-200 dark:bg-surface-700", text: "text-surface-600 dark:text-surface-300" };

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

function formatCountdown(autoApproveAt: string): { text: string; urgency: "normal" | "amber" | "red" } {
  const remainingMs = new Date(autoApproveAt).getTime() - Date.now();

  if (remainingMs <= 0) return { text: "Auto-approving now", urgency: "red" };

  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let text: string;
  if (hours > 0) {
    text = `Auto-approves in ${hours}h ${minutes > 0 ? `${minutes}m` : ""}`;
  } else {
    text = `Auto-approves in ${minutes}m`;
  }

  let urgency: "normal" | "amber" | "red" = "normal";
  if (totalMinutes < 30) urgency = "red";
  else if (hours < 2) urgency = "amber";

  return { text, urgency };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PendingSuggestions({ programId }: PendingSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Per-card UI state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actingAction, setActingAction] = useState<"APPROVE" | "REJECT" | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [fadingId, setFadingId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, visible: true });
    toastTimer.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3000);
  }

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchSuggestions = useCallback(
    (signal?: AbortSignal) => {
      setError(false);
      setLoading(true);

      fetch(`/api/throws/program/${programId}/suggestions?status=PENDING`, { signal })
        .then((res) => {
          if (!res.ok) throw new Error("fetch failed");
          return res.json();
        })
        .then((json) => {
          const list = json?.data?.suggestions;
          if (Array.isArray(list)) {
            setSuggestions(list);
          } else {
            setSuggestions([]);
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
    fetchSuggestions(controller.signal);
    return () => controller.abort();
  }, [fetchSuggestions]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleApprove(suggestionId: string) {
    setActingId(suggestionId);
    setActingAction("APPROVE");

    try {
      const res = await fetch(
        `/api/throws/program/${programId}/suggestions/${suggestionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ action: "APPROVE" }),
        },
      );
      if (!res.ok) throw new Error("approve failed");

      // Fade out then remove
      setFadingId(suggestionId);
      showToast("Suggestion approved");
      setTimeout(() => {
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
        setFadingId(null);
      }, 300);
    } catch {
      showToast("Failed to approve — please try again");
    } finally {
      setActingId(null);
      setActingAction(null);
    }
  }

  async function handleRejectConfirm(suggestionId: string) {
    setActingId(suggestionId);
    setActingAction("REJECT");

    try {
      const res = await fetch(
        `/api/throws/program/${programId}/suggestions/${suggestionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            action: "REJECT",
            rejectionReason: rejectionReason.trim() || undefined,
          }),
        },
      );
      if (!res.ok) throw new Error("reject failed");

      setFadingId(suggestionId);
      showToast("Suggestion rejected");
      setTimeout(() => {
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
        setFadingId(null);
        setRejectingId(null);
        setRejectionReason("");
      }, 300);
    } catch {
      showToast("Failed to reject — please try again");
    } finally {
      setActingId(null);
      setActingAction(null);
    }
  }

  function handleRejectClick(suggestionId: string) {
    if (rejectingId === suggestionId) {
      // Already showing input — confirm the rejection
      handleRejectConfirm(suggestionId);
    } else {
      // First click — reveal the rejection reason input
      setRejectingId(suggestionId);
      setRejectionReason("");
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="card p-5 animate-pulse space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-5 w-28 bg-[var(--muted-bg)] rounded-full" />
              <div className="flex-1" />
              <div className="h-3 w-32 bg-[var(--muted-bg)] rounded" />
            </div>
            <div className="h-4 w-3/4 bg-[var(--muted-bg)] rounded" />
            <div className="flex gap-2">
              <div className="h-7 w-20 bg-[var(--muted-bg)] rounded" />
              <div className="h-7 w-20 bg-[var(--muted-bg)] rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="card p-8 text-center space-y-3">
        <p className="text-sm text-red-500 dark:text-red-400">
          Failed to load suggestions.
        </p>
        <button
          onClick={() => fetchSuggestions()}
          className="btn-secondary text-xs px-4 py-1.5"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (suggestions.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-muted">
          No pending suggestions — the engine will surface recommendations here as your athletes train.
        </p>
      </div>
    );
  }

  // ── Suggestion cards ───────────────────────────────────────────────────────

  return (
    <div className="space-y-3 relative">
      {/* Toast */}
      {toast.visible && (
        <div className="sticky top-0 z-10 flex justify-center pointer-events-none">
          <div className="pointer-events-auto bg-emerald-600 dark:bg-emerald-500 text-white text-xs font-medium px-4 py-2 rounded-lg shadow-lg animate-fade-in">
            {toast.message}
          </div>
        </div>
      )}

      {suggestions.map((s) => {
        const config = TIMESCALE_CONFIG[s.timescale] ?? DEFAULT_TIMESCALE;
        const isFading = fadingId === s.id;
        const isActing = actingId === s.id;
        const isExpanded = expandedId === s.id;
        const isRejecting = rejectingId === s.id;

        let parsedChange: string | null = null;
        if (isExpanded && s.suggestedChange) {
          try {
            parsedChange = JSON.stringify(JSON.parse(s.suggestedChange), null, 2);
          } catch {
            parsedChange = s.suggestedChange;
          }
        }

        return (
          <div
            key={s.id}
            className={`card transition-opacity duration-300 ${isFading ? "opacity-0" : "opacity-100"}`}
          >
            <div className="p-4 space-y-3">
              {/* Header row */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Timescale badge */}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${config.bg} ${config.text}`}
                >
                  {config.label}
                </span>

                <span className="flex-1" />

                {/* Auto-approve countdown or expiry */}
                {s.autoApproveAt ? (
                  <AutoApproveCountdown autoApproveAt={s.autoApproveAt} />
                ) : (
                  <span className="text-[11px] text-muted shrink-0">
                    Expires {formatRelative(s.expiresAt)}
                  </span>
                )}
              </div>

              {/* Reasoning */}
              <p className="text-xs text-[var(--foreground)] leading-relaxed">
                {s.reasoning}
              </p>

              {/* Expand toggle */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
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
                {isExpanded ? "Hide details" : "View details"}
              </button>

              {/* Expanded JSON */}
              {isExpanded && parsedChange && (
                <pre className="text-[11px] text-muted bg-[var(--muted-bg)] rounded-lg p-3 overflow-x-auto font-mono leading-relaxed">
                  {parsedChange}
                </pre>
              )}

              {/* Rejection reason input */}
              {isRejecting && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Reason (optional, max 200 chars)"
                    maxLength={200}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="flex-1 text-xs px-3 py-1.5 rounded-md border border-[var(--card-border)] bg-[var(--muted-bg)] text-[var(--foreground)] placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => handleRejectConfirm(s.id)}
                    disabled={isActing}
                    className="text-xs px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 transition-colors shrink-0"
                  >
                    {isActing && actingAction === "REJECT" ? (
                      <Spinner />
                    ) : (
                      "Confirm rejection"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRejectingId(null); setRejectionReason(""); }}
                    className="text-[11px] text-muted hover:text-[var(--foreground)] transition-colors shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Action row */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleApprove(s.id)}
                  disabled={isActing}
                  className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors"
                >
                  {isActing && actingAction === "APPROVE" ? (
                    <span className="flex items-center gap-1.5">
                      <Spinner />
                      Approving
                    </span>
                  ) : (
                    "Approve"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleRejectClick(s.id)}
                  disabled={isActing || isRejecting}
                  className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function AutoApproveCountdown({ autoApproveAt }: { autoApproveAt: string }) {
  const [countdown, setCountdown] = useState(() => formatCountdown(autoApproveAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(formatCountdown(autoApproveAt));
    }, 60000); // update every minute
    return () => clearInterval(interval);
  }, [autoApproveAt]);

  const colorClass =
    countdown.urgency === "red"
      ? "text-red-500 dark:text-red-400"
      : countdown.urgency === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted";

  return (
    <span className={`text-[11px] shrink-0 tabular-nums font-medium ${colorClass}`}>
      {countdown.text}
    </span>
  );
}
