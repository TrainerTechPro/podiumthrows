"use client";

/**
 * Right-rail panel inside the plan wizard's exercise step. Fetches
 * Bondarchuk correlation-based recommendations for the wizard's
 * plan-level event and renders them grouped by category, sorted by
 * correlation. Read-only in H-2 — H-7 adds the inline Add-to-block action.
 */

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatImplementWeight } from "@/lib/throws";

type Recommendation = {
  id: string;
  name: string;
  category: string;
  event: string | null;
  implementWeight: number | null;
  equipment: string | null;
  correlation: number;
};

const CATEGORY_ORDER = ["CE", "SDE", "SPE", "GPE"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  CE: "Competitive",
  SDE: "Specialized Dev",
  SPE: "Specific Prep",
  GPE: "General Prep",
};

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function correlationColor(corr: number): string {
  if (corr >= 0.7) return "text-green-500";
  if (corr >= 0.4) return "text-amber-500";
  return "text-red-500";
}

function correlationBar(corr: number): string {
  if (corr >= 0.7) return "bg-green-500";
  if (corr >= 0.4) return "bg-amber-500";
  return "bg-red-500";
}

type Props = {
  event: string;
};

export function RecommenderRail({ event }: Props) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event) {
      setRecommendations([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/coach/throws/recommendations?event=${event}`)
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error || `Request failed (${res.status})`);
        }
        if (!cancelled) {
          setRecommendations(payload?.recommendations ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [event]);

  const grouped = useMemo(() => {
    const groups: Record<string, Recommendation[]> = {};
    for (const cat of CATEGORY_ORDER) groups[cat] = [];
    for (const rec of recommendations) {
      (groups[rec.category] ??= []).push(rec);
    }
    for (const cat of Object.keys(groups)) {
      groups[cat].sort((a, b) => b.correlation - a.correlation);
    }
    return groups;
  }, [recommendations]);

  return (
    <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Recommended</h3>
        <p className="text-xs text-muted mt-0.5">
          {event
            ? `Sorted by correlation for ${formatEventName(event)}`
            : "Set event in Basics step"}
        </p>
      </div>

      {!event ? (
        <div className="border border-dashed border-[var(--card-border)] rounded-lg p-4 text-center">
          <p className="text-xs text-muted">
            Go back to Basics and pick an event to see Bondarchuk correlations.
          </p>
        </div>
      ) : loading ? (
        <div className="rounded-lg p-4 text-center">
          <p className="text-xs text-muted">Loading…</p>
        </div>
      ) : error ? (
        <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-3">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="border border-dashed border-[var(--card-border)] rounded-lg p-4 text-center">
          <p className="text-xs text-muted">
            No correlation data for {formatEventName(event)} yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped[cat];
            if (!items || items.length === 0) return null;

            return (
              <div key={cat} className="space-y-1.5">
                <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                  {CATEGORY_LABELS[cat] ?? cat}
                </h4>
                <div className="space-y-1">
                  {items.map((rec) => (
                    <div
                      key={rec.id}
                      className="rounded-lg border border-[var(--card-border)] bg-surface-50 dark:bg-surface-900/50 p-2.5 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-[var(--foreground)] leading-tight">
                          {rec.name}
                        </p>
                        <span
                          className={`text-xs font-bold tabular-nums shrink-0 ${correlationColor(rec.correlation)}`}
                        >
                          {rec.correlation.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${correlationBar(rec.correlation)}`}
                          style={{ width: `${Math.max(5, rec.correlation * 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="neutral">{rec.category}</Badge>
                        {rec.implementWeight ? (
                          <span className="text-[10px] text-muted tabular-nums">
                            {formatImplementWeight(rec.implementWeight)}
                          </span>
                        ) : null}
                        {rec.equipment ? (
                          <span className="text-[10px] text-muted">{rec.equipment}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
