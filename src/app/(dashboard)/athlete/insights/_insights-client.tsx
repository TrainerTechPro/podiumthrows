"use client";
import { useState, useCallback, useTransition } from "react";
import { useToast } from "@/components/toast";
import { InsightList } from "@/components/insights/InsightList";
import { InsightProgressCard } from "@/components/insights/InsightProgressCard";
import { csrfHeaders } from "@/lib/csrf-client";
import type { AthleteInsightWire } from "@/lib/insights/types";
import type { InsightProgress } from "@/lib/insights/progress";

type Props = {
  athleteId: string;
  initialInsights: AthleteInsightWire[];
  progress: InsightProgress;
};

export function AthleteInsightsClient({ athleteId, initialInsights, progress }: Props) {
  const { toast } = useToast();
  const [insights, setInsights] = useState(initialInsights);
  const [showDismissed, setShowDismissed] = useState(false);
  const [isRecomputing, startRecomputing] = useTransition();

  const markRead = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/insights/${id}/read`, {
          method: "PATCH",
          headers: csrfHeaders(),
        });
        if (!res.ok) throw new Error(`mark read failed (${res.status})`);
        setInsights((prev) =>
          prev.map((i) => (i.id === id ? { ...i, readByAthleteAt: new Date().toISOString() } : i))
        );
      } catch (err) {
        toast(err instanceof Error ? err.message : "Mark-read failed", "error");
      }
    },
    [toast]
  );

  const dismiss = useCallback(
    async (id: string) => {
      // Snapshot the target item from the latest state (not a captured closure)
      // so rapid successive dismisses can each roll back just their own item.
      let target: AthleteInsightWire | undefined;
      setInsights((prev) => {
        target = prev.find((i) => i.id === id);
        return prev.filter((i) => i.id !== id);
      });
      try {
        const res = await fetch(`/api/insights/${id}/dismiss`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: "{}",
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to dismiss");
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to dismiss", "error");
        // Restore only the affected item; leave any other concurrent changes alone.
        if (target) {
          const restored = target;
          setInsights((prev) =>
            prev.some((i) => i.id === restored.id) ? prev : [...prev, restored]
          );
        }
      }
    },
    [toast]
  );

  const toggleDismissed = async () => {
    const next = !showDismissed;
    setShowDismissed(next);
    try {
      const res = await fetch(
        `/api/insights?athleteId=${athleteId}&mode=latest&includeDismissed=${next}`
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load");
      }
      setInsights(json.data.insights as AthleteInsightWire[]);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load", "error");
      setShowDismissed(!next);
    }
  };

  const recompute = () => {
    startRecomputing(async () => {
      try {
        const res = await fetch(`/api/insights/compute`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ athleteId }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to recompute");
        }
        toast(
          json.data.persistedCount === 0
            ? "No new insights"
            : `${json.data.persistedCount} insights updated`,
          "success"
        );
        const listRes = await fetch(
          `/api/insights?athleteId=${athleteId}&mode=latest&includeDismissed=${showDismissed}`
        );
        const listJson = await listRes.json();
        if (listRes.ok && listJson.success) {
          setInsights(listJson.data.insights as AthleteInsightWire[]);
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to recompute", "error");
      }
    });
  };

  return (
    <div className="relative">
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <header className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-2xl">Insights</h1>
          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={showDismissed} onChange={toggleDismissed} />
              <span className="text-muted">Show dismissed</span>
            </label>
            <button
              type="button"
              onClick={recompute}
              disabled={isRecomputing}
              className="btn-secondary text-xs"
            >
              {isRecomputing ? "Recomputing..." : "Recompute"}
            </button>
          </div>
        </header>

        {insights.length === 0 && !showDismissed ? (
          <InsightProgressCard progress={progress} />
        ) : (
          <InsightList
            insights={insights}
            role="ATHLETE"
            onMarkRead={markRead}
            onDismiss={dismiss}
          />
        )}
      </div>
    </div>
  );
}
