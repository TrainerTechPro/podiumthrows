"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import ExerciseCorrelationTable from "./exercise-correlation-table";
import VolumeMarkOverlay from "./volume-mark-overlay";
import PhaseComparisonPanel from "./phase-comparison-panel";
import AdaptationIntelligencePanel from "./adaptation-intelligence-panel";

interface ProgramAnalysisTabProps {
  programId?: string;
  analyticsData?: Record<string, unknown> | null;
  phases: Array<{
    id: string;
    phase: string;
    phaseOrder: number;
    startWeek: number;
    endWeek: number;
    durationWeeks: number;
    throwsPerWeekTarget: number;
    status: string;
  }>;
}

interface ExerciseData {
  exercise: string;
  type: string;
  correlation: number;
  absCorrelation: number;
  isInCurrentComplex: boolean;
  personalR: number | null;
  blendedR: number | null;
}

interface PhaseStats {
  phase: string;
  phaseOrder: number;
  durationWeeks: number;
  totalThrows: number;
  avgMark: number;
  avgRpe: number;
  effectivenessScore: number;
  exercises: string[];
  status: string;
}

async function safeFetchJson(url: string, signal?: AbortSignal): Promise<{ ok: boolean; data: unknown }> {
  const res = await fetch(url, { signal });
  if (!res.ok) return { ok: false, data: null };
  try {
    const json = await res.json();
    return { ok: true, data: json };
  } catch {
    return { ok: false, data: null };
  }
}

export default function ProgramAnalysisTab({
  programId,
  phases,
  analyticsData: prefetchedAnalytics,
}: ProgramAnalysisTabProps) {
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [fetchedAnalytics, setFetchedAnalytics] = useState<Record<string, unknown> | null>(null);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(!prefetchedAnalytics);
  const [exerciseError, setExerciseError] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(false);

  const fetchExercises = useCallback((signal?: AbortSignal) => {
    setExerciseError(false);
    setLoadingExercises(true);
    safeFetchJson("/api/coach/my-program/exercises", signal)
      .then((result) => {
        if (result.ok) {
          const d = result.data as Record<string, unknown>;
          const exercises = (d?.data as Record<string, unknown>)?.exercises;
          if (Array.isArray(exercises)) setExercises(exercises);
          else setExerciseError(true);
        } else {
          setExerciseError(true);
        }
      })
      .catch((err) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) setExerciseError(true);
      })
      .finally(() => setLoadingExercises(false));
  }, []);

  const fetchAnalytics = useCallback((signal?: AbortSignal) => {
    setAnalyticsError(false);
    setLoadingAnalytics(true);
    safeFetchJson("/api/coach/my-program/analytics", signal)
      .then((result) => {
        if (result.ok) {
          const d = result.data as Record<string, unknown>;
          const data = d?.data as Record<string, unknown>;
          if (data) setFetchedAnalytics(data);
          else setAnalyticsError(true);
        } else {
          setAnalyticsError(true);
        }
      })
      .catch((err) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) setAnalyticsError(true);
      })
      .finally(() => setLoadingAnalytics(false));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchExercises(controller.signal);
    // Only fetch analytics if parent didn't provide it
    if (!prefetchedAnalytics) fetchAnalytics(controller.signal);
    return () => controller.abort();
  }, [fetchExercises, fetchAnalytics, prefetchedAnalytics]);

  const analyticsData = prefetchedAnalytics ?? fetchedAnalytics;

  // M6-C: Memoize phase stats — only recompute when phases change
  const phaseStats = useMemo<PhaseStats[]>(() => phases.map((p) => ({
    phase: p.phase,
    phaseOrder: p.phaseOrder,
    durationWeeks: p.durationWeeks,
    totalThrows: 0,
    avgMark: 0,
    avgRpe: 0,
    effectivenessScore: 0,
    exercises: [],
    status: p.status,
  })), [phases]);

  // M7-A: Memoize derived arrays for stable references to VolumeMarkOverlay
  const weeklyData = useMemo(() => analyticsData?.weeklyData as {
    volume: number[];
    marks: number[];
  } | null, [analyticsData]);

  const overlayPhases = useMemo(() => phases.map((p) => ({
    startWeek: p.startWeek,
    endWeek: p.endWeek,
    phase: p.phase,
  })), [phases]);

  return (
    <div className="space-y-8">
      {/* Exercise Correlation Explorer */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">
          Exercise Correlation Explorer
        </h3>
        <p className="text-xs text-muted mb-3">
          All exercises from the Bondarchuk correlation database for your event, gender, and distance band.
          Sorted by absolute correlation strength.
        </p>
        {loadingExercises ? (
          <div className="card p-6 animate-pulse">
            <div className="h-4 bg-[var(--muted-bg)] rounded w-48 mb-3" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 bg-[var(--muted-bg)] rounded" />
              ))}
            </div>
          </div>
        ) : exerciseError ? (
          <div className="card p-8 text-center space-y-3">
            <p className="text-sm text-red-500 dark:text-red-400">Failed to load exercise data.</p>
            <button onClick={() => fetchExercises()} className="btn-secondary text-xs px-4 py-1.5">Try Again</button>
          </div>
        ) : exercises.length > 0 ? (
          <ExerciseCorrelationTable exercises={exercises} />
        ) : (
          <div className="card p-8 text-center">
            <p className="text-sm text-muted">No exercise data available for your configuration.</p>
          </div>
        )}
      </section>

      {/* Volume x Mark Overlay Chart */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">
          Volume vs Mark Trends
        </h3>
        <p className="text-xs text-muted mb-3">
          Weekly throw volume (bars) overlaid with best mark per week (line).
          Phase boundaries shown as background regions.
        </p>
        {loadingAnalytics ? (
          <div className="card p-6 animate-pulse">
            <div className="h-48 bg-[var(--muted-bg)] rounded" />
          </div>
        ) : analyticsError ? (
          <div className="card p-8 text-center space-y-3">
            <p className="text-sm text-red-500 dark:text-red-400">Failed to load analytics data.</p>
            <button onClick={() => fetchAnalytics()} className="btn-secondary text-xs px-4 py-1.5">Try Again</button>
          </div>
        ) : (
          <div className="card p-5">
            <VolumeMarkOverlay
              weeklyVolume={weeklyData?.volume ?? []}
              weeklyMarks={weeklyData?.marks ?? []}
              phases={overlayPhases}
            />
          </div>
        )}
      </section>

      {/* Phase Comparison */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">
          Phase Comparison
        </h3>
        <p className="text-xs text-muted mb-3">
          Side-by-side comparison of completed and active phases with key metrics.
        </p>
        <PhaseComparisonPanel phases={phaseStats} />
      </section>

      {/* Adaptation Intelligence */}
      {programId && (
        <section>
          <AdaptationIntelligencePanel programId={programId} />
        </section>
      )}
    </div>
  );
}
