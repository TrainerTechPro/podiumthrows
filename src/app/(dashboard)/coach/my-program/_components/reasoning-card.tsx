"use client";

import { useId, useState } from "react";

interface ReasoningCardProps {
  title: string;
  brief: string;
  details: string;
  category: "phase" | "volume" | "exercise" | "taper" | "deficit";
  reference?: string;
}

const CATEGORY_STYLES: Record<string, { color: string; icon: string }> = {
  phase: { color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  volume: { color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20", icon: "M9 19V6l12-3v13M9 19c0 1.1-1.3 2-3 2s-3-.9-3-2 1.3-2 3-2 3 .9 3 2zm12-3c0 1.1-1.3 2-3 2s-3-.9-3-2 1.3-2 3-2 3 .9 3 2z" },
  exercise: { color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
  taper: { color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20", icon: "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" },
  deficit: { color: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" },
};

export default function ReasoningCard({
  title,
  brief,
  details,
  category,
  reference,
}: ReasoningCardProps) {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.phase;

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${style.color}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={style.icon} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-[var(--foreground)]">{title}</h4>
          <p className="text-xs text-muted mt-0.5 line-clamp-2">{brief}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={detailId}
          aria-label={`Why: ${title}`}
          className="text-xs text-muted hover:text-[var(--foreground)] transition-colors shrink-0 flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 rounded"
        >
          Why?
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div
        id={detailId}
        role="region"
        aria-label={`Details for ${title}`}
        className={expanded ? "mt-3 pt-3 border-t border-[var(--card-border)]" : "hidden"}
      >
        <p className="text-xs text-[var(--foreground)] leading-relaxed whitespace-pre-line">
          {details}
        </p>
        {reference && (
          <p className="text-[11px] text-muted mt-2 italic">{reference}</p>
        )}
      </div>
    </div>
  );
}
