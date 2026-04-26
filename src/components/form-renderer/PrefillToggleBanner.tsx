"use client";

import { Sparkles } from "lucide-react";

interface PrefillToggleBannerProps {
  /** Number of fields currently prefilled from a previous response. */
  prefilledCount: number;
  /** ISO timestamp of the previous response, or null. */
  previousCompletedAt: string | null;
  /** Whether the toggle is currently on. */
  on: boolean;
  /** Toggle setter. */
  onChange: (next: boolean) => void;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "your last submission";
  const then = new Date(iso);
  const now = new Date();
  const days = Math.round((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "earlier today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.round(days / 7)} weeks ago`;
  if (days < 60) return "1 month ago";
  return `${Math.round(days / 30)} months ago`;
}

export function PrefillToggleBanner({
  prefilledCount,
  previousCompletedAt,
  on,
  onChange,
}: PrefillToggleBannerProps) {
  // Don't render if there's nothing to prefill (first-time submission).
  if (!previousCompletedAt) return null;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-xl border border-primary-500/20 bg-primary-500/5"
      role="region"
      aria-label="Prefill from previous answers"
    >
      <Sparkles
        size={16}
        strokeWidth={1.75}
        className="text-primary-500 shrink-0"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0 text-sm text-[var(--foreground)]">
        <span className="font-medium">Use previous answers</span>
        <span className="text-muted ml-1.5">
          {on
            ? prefilledCount > 0
              ? `${prefilledCount} ${prefilledCount === 1 ? "field" : "fields"} filled from ${formatRelative(previousCompletedAt)}`
              : `from ${formatRelative(previousCompletedAt)}`
            : `disabled — previous from ${formatRelative(previousCompletedAt)}`}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={on ? "Turn off prefill" : "Turn on prefill"}
        onClick={() => onChange(!on)}
        className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${
          on ? "bg-primary-500" : "bg-surface-300 dark:bg-surface-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            on ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

interface PrefillFieldHintProps {
  visible: boolean;
  onDismiss?: () => void;
}

/** Subtle per-field "From last time — edit to change" indicator. */
export function PrefillFieldHint({ visible, onDismiss }: PrefillFieldHintProps) {
  if (!visible) return null;
  return (
    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-primary-600 dark:text-primary-400">
      <Sparkles size={12} strokeWidth={1.75} aria-hidden="true" />
      <span>From last time — edit to change</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto text-muted hover:text-[var(--foreground)] transition-colors"
          aria-label="Dismiss prefill hint"
        >
          ×
        </button>
      )}
    </div>
  );
}
