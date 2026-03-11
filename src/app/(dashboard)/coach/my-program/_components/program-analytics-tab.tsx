"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import MarkPredictionChart from "./mark-prediction-chart";
import DeficitAttributionPanel from "./deficit-attribution-panel";
import AdaptationProgressGauge from "./adaptation-progress-gauge";
import TaperPreviewChart from "./taper-preview-chart";
import ReasoningCard from "./reasoning-card";

interface ProgramAnalyticsTabProps {
  programId: string;
  analyticsData?: Record<string, unknown> | null;
}

export default function ProgramAnalyticsTab({ programId, analyticsData: prefetchedData }: ProgramAnalyticsTabProps) {
  const [fetchedData, setFetchedData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(!prefetchedData);
  const [error, setError] = useState("");

  const fetchAnalytics = useCallback(async (signal?: AbortSignal) => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/coach/my-program/analytics", { signal });
      if (!res.ok) {
        let message = "Failed to load analytics.";
        try {
          const err = await res.json();
          if (err?.error) message = err.error;
        } catch { /* non-JSON */ }
        throw new Error(message);
      }
      const json = await res.json();
      setFetchedData(json.data ?? null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Only fetch if parent didn't provide data
  useEffect(() => {
    if (prefetchedData) return;
    const controller = new AbortController();
    fetchAnalytics(controller.signal);
    return () => controller.abort();
  }, [programId, fetchAnalytics, prefetchedData]);

  const data = prefetchedData ?? fetchedData;

  // M6-B: Memoize derived data extractions — must be called before early returns (hooks rules)
  const derived = useMemo(() => {
    if (!data) return null;
    const mp = data.markPrediction as { a: number; b: number; rSquared: number; predictedMark: number } | null;
    const ee = data.exerciseEffectiveness as Array<{ complexId: string; effectiveness: number; markImprovement: number; rank: number }> | null;
    const da = data.deficitAttribution as Array<{ type: string; confidence: number; evidence: string; suggestedAction: string }> | null;
    const ap = data.adaptationProgress as { progress: number; phase: string; label: string } | null;
    const va = data.volumeAdherence as { prescribed: number; actual: number; ratio: number } | null;
    const ti = data.transferIndex as { score: number | null; exercises: Array<{ name: string; expected: number; observed: number }> } | null;
    const tp = data.taperPreview as { weekMultipliers: Array<{ weekIndex: number; volumeMultiplier: number; rationale: string }>; taperDuration: number; rationale: string } | null;
    const wd = data.weeklyData as { volume: number[]; marks: number[]; rpe: number[] } | null;
    const rc = (data.reasoningCards ?? []) as Array<{ id: string; title: string; brief: string; details: string; category: "phase" | "volume" | "exercise" | "taper" | "deficit"; reference?: string }>;
    const tm = (data.totalMarks ?? 0) as number;
    // M7-B: Cache filtered marks so MarkPredictionChart gets a stable reference
    const fm = wd?.marks?.filter((m) => m > 0) ?? [];
    // Pre-sort effectiveness to avoid inline .sort() in render
    const se = ee ? [...ee].sort((a, b) => b.effectiveness - a.effectiveness) : null;
    return {
      markPrediction: mp, deficitAttribution: da,
      adaptationProgress: ap, volumeAdherence: va, transferIndex: ti,
      taperPreview: tp, reasoningCards: rc, totalMarks: tm,
      filteredMarks: fm, sortedEffectiveness: se,
    };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-6 animate-pulse">
            <div className="h-4 bg-[var(--muted-bg)] rounded w-32 mb-3" />
            <div className="h-32 bg-[var(--muted-bg)] rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !derived) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-sm text-red-500 dark:text-red-400">{error || "No data available."}</p>
        <button onClick={() => fetchAnalytics()} className="btn-secondary text-sm px-5 py-2">
          Try Again
        </button>
      </div>
    );
  }

  const {
    markPrediction, deficitAttribution, adaptationProgress,
    volumeAdherence, transferIndex, taperPreview, reasoningCards,
    totalMarks, filteredMarks, sortedEffectiveness,
  } = derived;

  return (
    <div className="space-y-6">
      {/* Data status notice */}
      {totalMarks < 5 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Analytics improve with more data. You have {totalMarks} mark{totalMarks !== 1 ? "s" : ""} recorded — log more sessions for accurate predictions.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Mark Prediction */}
        <div className="card p-5 md:col-span-2">
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">Mark Prediction</h4>
          <MarkPredictionChart
            marks={filteredMarks}
            prediction={markPrediction}
            goalDistance={undefined}
          />
        </div>

        {/* Adaptation Progress */}
        <div className="card p-5 flex items-center justify-center">
          {adaptationProgress ? (
            <AdaptationProgressGauge
              progress={adaptationProgress.progress}
              phase={adaptationProgress.phase}
              label={adaptationProgress.label}
            />
          ) : (
            <p className="text-sm text-muted">No adaptation data yet.</p>
          )}
        </div>

        {/* Exercise Effectiveness */}
        <div className="card p-5">
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">Exercise Effectiveness</h4>
          {sortedEffectiveness && sortedEffectiveness.length > 0 ? (
            <div className="space-y-2">
              {sortedEffectiveness
                .map((ce) => (
                  <div key={ce.complexId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--foreground)] font-medium truncate">
                        Complex #{ce.rank}
                      </span>
                      <span className="text-muted tabular-nums">
                        {Math.round(ce.effectiveness * 100)}%
                      </span>
                    </div>
                    <div
                      className="h-1.5 bg-[var(--muted-bg)] rounded-full overflow-hidden"
                      role="meter"
                      aria-valuenow={Math.round(ce.effectiveness * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Complex #${ce.rank} effectiveness: ${Math.round(ce.effectiveness * 100)}%`}
                    >
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.round(ce.effectiveness * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted">
                      {ce.markImprovement >= 0 ? "+" : ""}{ce.markImprovement.toFixed(2)}m improvement
                    </p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-4">Complete more sessions to see effectiveness.</p>
          )}
        </div>

        {/* Deficit Attribution */}
        <div className="card p-5">
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">Deficit Analysis</h4>
          <DeficitAttributionPanel deficits={deficitAttribution ?? []} />
        </div>

        {/* Volume Adherence */}
        <div className="card p-5">
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">Volume Adherence</h4>
          {volumeAdherence ? (
            <div className="space-y-3">
              <div className="flex items-end gap-4 justify-center">
                <div className="text-center">
                  <p className="text-2xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                    {volumeAdherence.actual}
                  </p>
                  <p className="text-[10px] text-muted uppercase tracking-wide">Actual</p>
                </div>
                <div className="text-center text-muted text-xl mb-1">/</div>
                <div className="text-center">
                  <p className="text-2xl font-bold font-heading text-muted tabular-nums">
                    {volumeAdherence.prescribed}
                  </p>
                  <p className="text-[10px] text-muted uppercase tracking-wide">Prescribed</p>
                </div>
              </div>
              <div
                className="h-2 bg-[var(--muted-bg)] rounded-full overflow-hidden"
                role="meter"
                aria-valuenow={Math.round(volumeAdherence.ratio * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Volume adherence: ${Math.round(volumeAdherence.ratio * 100)}%, ${volumeAdherence.actual} of ${volumeAdherence.prescribed} throws`}
              >
                <div
                  className={`h-full rounded-full transition-all ${
                    volumeAdherence.ratio >= 0.9
                      ? "bg-emerald-500"
                      : volumeAdherence.ratio >= 0.7
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${Math.min(100, volumeAdherence.ratio * 100)}%` }}
                />
              </div>
              <p className="text-xs text-center text-muted" aria-hidden="true">
                {Math.round(volumeAdherence.ratio * 100)}% adherence
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-4">No volume data yet.</p>
          )}
        </div>

        {/* Transfer Index */}
        <div className="card p-5">
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">Transfer Index</h4>
          {transferIndex?.score !== null && transferIndex?.score !== undefined ? (
            <div className="text-center space-y-2">
              <p className="text-4xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                {transferIndex.score}
                <span className="text-lg font-medium text-muted">/100</span>
              </p>
              <p className="text-xs text-muted">
                How well current exercises transfer to competition performance
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-4">Transfer index not available.</p>
          )}
        </div>

        {/* Taper Preview */}
        {taperPreview && (
          <div className="card p-5 md:col-span-2">
            <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">Taper Preview</h4>
            <TaperPreviewChart taperPlan={taperPreview} />
          </div>
        )}
      </div>

      {/* Reasoning Cards */}
      {reasoningCards.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">Engine Reasoning</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {reasoningCards.map((card) => (
              <ReasoningCard key={card.id} {...card} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
