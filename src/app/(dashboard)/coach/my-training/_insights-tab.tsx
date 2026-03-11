"use client";

import { useState, useEffect } from "react";
import { LineChart } from "@/components/charts/LineChart";

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface VolumeData {
  weeklyVolume: { week: string; sessions: number; throws: number }[];
  exerciseFrequency: { exercise: string; count: number }[];
  streaks: { current: number; longest: number };
  rpeTrend: { label: string; value: number }[];
  distanceTrends: { implement: string; data: { label: string; value: number }[] }[];
}

interface AnalysisData {
  implementDistribution: { implement: string; count: number; percentage: number }[];
  sequencingCompliance: { totalSessions: number; violations: number; complianceRate: number };
  differentialWarnings: { implement: string; event: string; message: string }[];
}

const IMPL_COLORS = [
  "#D4A843", "#5BB88A", "#6B8FD4", "#D46A6A", "#9B6BD4",
  "#D49B6B", "#6BD4C0", "#D46BB4",
];

/* ─── Insights Tab ─────────────────────────────────────────────────────────── */

export function InsightsTab() {
  const [volume, setVolume] = useState<VolumeData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/coach/my-training/volume").then((r) => r.json()),
      fetch("/api/coach/my-training/analysis").then((r) => r.json()),
    ])
      .then(([vol, anal]) => {
        setVolume(vol);
        setAnalysis(anal);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card h-48 animate-pulse bg-surface-100 dark:bg-surface-800" />
        ))}
      </div>
    );
  }

  if (!volume) {
    return (
      <div className="card py-12 text-center">
        <p className="text-sm text-muted">No training data available yet.</p>
      </div>
    );
  }

  const currentWeekThrows = volume.weeklyVolume[volume.weeklyVolume.length - 1]?.throws ?? 0;
  const prevWeekThrows = volume.weeklyVolume[volume.weeklyVolume.length - 2]?.throws ?? 0;
  const throwsDelta = currentWeekThrows - prevWeekThrows;

  return (
    <div className="space-y-4">
      {/* Volume Chart + Stats */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">
          Training Volume
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Mini bar chart */}
          <div className="sm:col-span-2">
            <div className="flex items-end gap-1 h-24">
              {volume.weeklyVolume.slice(-8).map((w, i, arr) => {
                const max = Math.max(...arr.map((x) => x.sessions), 1);
                const height = (w.sessions / max) * 100;
                const isCurrent = i === arr.length - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    {w.sessions > 0 && (
                      <span className="text-[10px] tabular-nums text-muted">{w.sessions}</span>
                    )}
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        isCurrent
                          ? "bg-primary-500"
                          : "bg-surface-200 dark:bg-surface-700"
                      }`}
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                    <span className="text-[9px] text-muted truncate w-full text-center">
                      {w.week.split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats column */}
          <div className="space-y-3">
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider">Throws this week</span>
              <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
                {currentWeekThrows}
                {throwsDelta !== 0 && (
                  <span className={`text-xs ml-1 ${throwsDelta > 0 ? "text-green-500" : "text-red-500"}`}>
                    {throwsDelta > 0 ? "+" : ""}{throwsDelta}
                  </span>
                )}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider">Current streak</span>
              <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
                {volume.streaks.current} day{volume.streaks.current !== 1 ? "s" : ""}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider">Best streak</span>
              <p className="text-sm font-semibold tabular-nums text-muted">
                {volume.streaks.longest} day{volume.streaks.longest !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RPE Trend */}
      {volume.rpeTrend.length > 2 && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">
            RPE Trend
          </h3>
          <LineChart
            data={volume.rpeTrend}
            height={160}
            yMin={1}
            yMax={10}
            color="#D4A843"
            showArea={false}
            formatY={(v) => `${v}`}
          />
        </div>
      )}

      {/* Distance Trends */}
      {volume.distanceTrends.length > 0 && volume.distanceTrends.some((t) => t.data.length > 1) && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">
            Distance Trends
          </h3>
          <LineChart
            series={volume.distanceTrends
              .filter((t) => t.data.length > 1)
              .map((t, i) => ({
                data: t.data,
                color: IMPL_COLORS[i % IMPL_COLORS.length],
                label: t.implement,
              }))}
            height={180}
            formatY={(v) => `${v.toFixed(1)}m`}
            showArea={false}
          />
          <div className="flex flex-wrap gap-3 mt-2">
            {volume.distanceTrends
              .filter((t) => t.data.length > 1)
              .map((t, i) => (
                <div key={t.implement} className="flex items-center gap-1.5 text-xs text-muted">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: IMPL_COLORS[i % IMPL_COLORS.length] }}
                  />
                  {t.implement}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Implement Distribution */}
      {analysis && analysis.implementDistribution.length > 0 && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">
            Implement Distribution
          </h3>
          <div className="space-y-2">
            {analysis.implementDistribution.map((item) => (
              <div key={item.implement} className="flex items-center gap-3">
                <span className="text-xs font-semibold w-16 text-[var(--foreground)] tabular-nums">{item.implement}</span>
                <div className="flex-1 bg-surface-100 dark:bg-surface-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-primary-500 h-full rounded-full transition-all"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <span className="text-xs text-muted tabular-nums w-10 text-right">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drill Frequency */}
      {volume.exerciseFrequency.length > 0 && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">
            Top Drills
          </h3>
          <div className="flex flex-wrap gap-2">
            {volume.exerciseFrequency.slice(0, 8).map((d) => (
              <span
                key={d.exercise}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-[var(--foreground)]"
              >
                {d.exercise} <span className="text-muted ml-1">{d.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sequencing Compliance */}
      {analysis && analysis.sequencingCompliance.totalSessions > 0 && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">
            Sequencing Compliance
          </h3>
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold tabular-nums text-[var(--foreground)]">
              {analysis.sequencingCompliance.complianceRate}%
            </div>
            <div className="text-xs text-muted">
              <p>{analysis.sequencingCompliance.totalSessions} sessions with multiple implements</p>
              <p>{analysis.sequencingCompliance.violations} with ascending violations</p>
            </div>
          </div>
        </div>
      )}

      {/* Weight Differential Warnings */}
      {analysis && analysis.differentialWarnings.length > 0 && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">
            Weight Differential Warnings
          </h3>
          <div className="space-y-2">
            {analysis.differentialWarnings.map((w, i) => (
              <div key={i} className="flex gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 shrink-0 mt-0.5">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <p className="text-xs text-amber-800 dark:text-amber-300">{w.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
