"use client";

/**
 * Right-rail panel inside the plan wizard's exercise step. Fetches
 * Bondarchuk correlation-based recommendations for the wizard's
 * plan-level event and renders them grouped by category, sorted by
 * correlation. Read-only in H-2 — H-7 adds the inline Add-to-block action.
 */

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatImplementWeight } from "@/lib/throws";
import { Plus, Check, AlertTriangle } from "lucide-react";

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
  if (corr >= 0.7) return "text-success-500";
  if (corr >= 0.4) return "text-primary-500";
  return "text-danger-500";
}

function correlationBar(corr: number): string {
  if (corr >= 0.7) return "bg-success-500";
  if (corr >= 0.4) return "bg-primary-500";
  return "bg-danger-500";
}

type AddResult = { ok: true } | { ok: false; reason: string };

type Props = {
  event: string;
  /**
   * Parent-supplied adder. Runs pre-flight Bondarchuk validation and
   * returns a structured result so the rail can show per-card feedback.
   */
  onAdd?: (rec: Recommendation) => AddResult;
};

type CardState = { status: "idle" } | { status: "added" } | { status: "blocked"; reason: string };

export function RecommenderRail({ event, onAdd }: Props) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardState, setCardState] = useState<Record<string, CardState>>({});

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
          setRecommendations(payload?.data?.recommendations ?? []);
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

  function handleAdd(rec: Recommendation) {
    if (!onAdd) return;
    const result = onAdd(rec);
    if (result.ok) {
      setCardState((s) => ({ ...s, [rec.id]: { status: "added" } }));
      // Revert the badge after a beat so the coach can add the same exercise
      // to a different block without the UI lying about state.
      setTimeout(() => {
        setCardState((s) => {
          if (s[rec.id]?.status !== "added") return s;
          const next = { ...s };
          delete next[rec.id];
          return next;
        });
      }, 2500);
    } else {
      setCardState((s) => ({ ...s, [rec.id]: { status: "blocked", reason: result.reason } }));
    }
  }

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
        <div className="border border-danger-500/30 bg-danger-500/10 rounded-lg p-3">
          <p className="text-xs text-danger-600 dark:text-danger-400">{error}</p>
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
                <h4 className="text-nano font-semibold text-muted uppercase tracking-wider">
                  {CATEGORY_LABELS[cat] ?? cat}
                </h4>
                <div className="space-y-1">
                  {items.map((rec) => {
                    const state = cardState[rec.id] ?? { status: "idle" };
                    return (
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
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <Badge variant="neutral">{rec.category}</Badge>
                            {rec.implementWeight ? (
                              <span className="text-nano text-muted tabular-nums">
                                {formatImplementWeight(rec.implementWeight)}
                              </span>
                            ) : null}
                            {rec.equipment ? (
                              <span className="text-nano text-muted">{rec.equipment}</span>
                            ) : null}
                          </div>
                          {onAdd && (
                            <Button
                              size="sm"
                              variant="ghost"
                              leftIcon={
                                state.status === "added" ? (
                                  <Check
                                    size={12}
                                    strokeWidth={1.75}
                                    className="text-success-500"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Plus size={12} strokeWidth={1.75} aria-hidden="true" />
                                )
                              }
                              onClick={() => handleAdd(rec)}
                              aria-label={`Add ${rec.name} to current block`}
                              className="!px-2 !py-1 !text-micro !h-auto"
                            >
                              {state.status === "added" ? "Added" : "Add"}
                            </Button>
                          )}
                        </div>
                        {state.status === "blocked" && (
                          <div className="flex items-start gap-1.5 pt-1 border-t border-primary-500/20">
                            <AlertTriangle
                              size={12}
                              strokeWidth={1.75}
                              className="text-primary-600 dark:text-primary-400 shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <p className="text-nano text-primary-700 dark:text-primary-400 leading-tight">
                              {state.reason}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
