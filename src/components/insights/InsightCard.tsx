"use client";
import { useEffect, useRef } from "react";
import { Activity, Dumbbell, Heart } from "lucide-react";
import type { AthleteInsightWire } from "@/lib/insights/types";

type Props = {
  insight: AthleteInsightWire;
  role: "COACH" | "ATHLETE";
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onShowEvidence?: (id: string) => void;
};

const CATEGORY_ICON = {
  TRAINING_PATTERN: Activity,
  LIFT_THROW: Dumbbell,
  READINESS_COMPETITION: Heart,
} as const;

const BAND_CLASSES: Record<"WEAK" | "MEDIUM" | "STRONG", string> = {
  WEAK: "bg-surface-200 text-muted dark:bg-surface-800",
  MEDIUM: "bg-warning-500/20 text-warning-500",
  STRONG: "bg-primary-500/20 text-primary-500",
};

/**
 * Short display labels for the badge.
 * Note: avoid repeating words used in detail text to prevent
 * multiple-element matches in getByText queries (MEDIUM badge vs detail text).
 * The aria-label carries the full value for screen readers.
 */
const BAND_LABEL: Record<"WEAK" | "MEDIUM" | "STRONG", string> = {
  WEAK: "Low",
  MEDIUM: "Mid",
  STRONG: "High",
};

export function InsightCard({ insight, role, onMarkRead, onDismiss, onShowEvidence }: Props) {
  const readKey = role === "COACH" ? insight.readByCoachAt : insight.readByAthleteAt;
  const isUnread = readKey == null;
  const hasFiredReadRef = useRef(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const Icon = CATEGORY_ICON[insight.category];

  useEffect(() => {
    if (!isUnread) return;
    if (typeof window === "undefined") return;
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasFiredReadRef.current) {
            hasFiredReadRef.current = true;
            onMarkRead(insight.id);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px", threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [insight.id, isUnread, onMarkRead]);

  return (
    <article ref={cardRef} className="card relative p-4" data-testid={`insight-card-${insight.id}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
          <span
            aria-label={`Confidence: ${insight.confidenceBand}`}
            className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${BAND_CLASSES[insight.confidenceBand]}`}
          >
            {BAND_LABEL[insight.confidenceBand]}
          </span>
        </div>
        {isUnread && (
          <span
            data-testid="insight-new-dot"
            aria-label="New insight"
            className="h-2 w-2 rounded-full bg-primary-500"
          />
        )}
      </header>

      <h3 className="mt-3 font-heading text-base">{insight.title}</h3>
      <p className="mt-2 text-sm">{insight.body}</p>
      {insight.detail && <p className="mt-1 text-xs text-muted">{insight.detail}</p>}

      <footer className="mt-4 flex items-center justify-between gap-2">
        {role === "COACH" && onShowEvidence ? (
          <button
            type="button"
            onClick={() => onShowEvidence(insight.id)}
            className="text-xs text-primary-500 hover:underline"
          >
            Evidence →
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => onDismiss(insight.id)}
          className="text-xs text-muted hover:text-danger-500"
        >
          Dismiss
        </button>
      </footer>
    </article>
  );
}
