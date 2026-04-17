"use client";
import { useState, useCallback, useTransition } from "react";
import { useToast } from "@/components/toast";
import { InsightList } from "@/components/insights/InsightList";
import { InsightEvidenceDrawer } from "@/components/insights/InsightEvidenceDrawer";
import { csrfHeaders } from "@/lib/csrf-client";
import type { AthleteInsightWire } from "@/lib/insights/types";

type Props = {
  athleteId: string;
  athleteName: string;
  initialInsights: AthleteInsightWire[];
};

export function CoachInsightsSection({ athleteId, athleteName, initialInsights }: Props) {
  const { toast } = useToast();
  const [insights, setInsights] = useState(initialInsights);
  const [showDismissed, setShowDismissed] = useState(false);
  const [evidenceFor, setEvidenceFor] = useState<AthleteInsightWire | null>(null);
  const [isRecomputing, startRecomputing] = useTransition();

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/insights/${id}/read`, { method: "PATCH", headers: csrfHeaders() });
      setInsights((prev) =>
        prev.map((i) => (i.id === id ? { ...i, readByCoachAt: new Date().toISOString() } : i))
      );
    } catch (err) {
      console.error("mark read failed", err);
    }
  }, []);

  const dismiss = useCallback(
    async (id: string) => {
      const prev = insights;
      setInsights(prev.filter((i) => i.id !== id));
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
        setInsights(prev);
      }
    },
    [insights, toast]
  );

  const showEvidence = (id: string) => {
    const found = insights.find((i) => i.id === id);
    if (found) setEvidenceFor(found);
  };

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
    <section id="insights" className="scroll-mt-20 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-xl">Insights</h2>
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5">
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

      <InsightList
        insights={insights}
        role="COACH"
        athleteName={athleteName}
        onMarkRead={markRead}
        onDismiss={dismiss}
        onShowEvidence={showEvidence}
      />

      {evidenceFor && (
        <InsightEvidenceDrawer insight={evidenceFor} onClose={() => setEvidenceFor(null)} />
      )}
    </section>
  );
}
