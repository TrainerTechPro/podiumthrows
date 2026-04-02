"use client";

import Link from "next/link";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

/* ─── Types ────────────────────────────────────────────────────────────────── */

export type AngleSummary = {
  key: string;
  label: string;
  degrees: number;
  status: "optimal" | "marginal" | "concerning";
};

export type LatestInsight = {
  id: string;
  title: string;
  event: string;
  athleteName: string;
  angles: AngleSummary[] | null;
};

type Props = {
  totalCount: number;
  completedCount: number;
  eventCounts: Record<string, number>;
  latestInsight: LatestInsight | null;
};

/* ─── Constants ────────────────────────────────────────────────────────────── */

const EVENT_COLORS: Record<string, string> = {
  SHOT_PUT: "#E85D26",
  DISCUS: "#3a90c8",
  HAMMER: "#d55042",
  JAVELIN: "#34a05a",
};

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

const STATUS_DOT: Record<string, string> = {
  optimal: "bg-success-500",
  marginal: "bg-warning-500",
  concerning: "bg-danger-500",
};

const STATUS_SYMBOL: Record<string, string> = {
  optimal: "✓",
  marginal: "~",
  concerning: "!",
};

/* ─── Component ────────────────────────────────────────────────────────────── */

export function AnalysisSummary({
  totalCount,
  completedCount,
  eventCounts,
  latestInsight,
}: Props) {
  const maxEventCount = Math.max(...Object.values(eventCounts), 1);
  const activeEvents = Object.entries(eventCounts)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);
  const pendingCount = totalCount - completedCount;

  return (
    <>
      <style>{`
        @keyframes summary-bar-grow {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .summary-bar { animation: none !important; transform: scaleX(1) !important; }
        }
      `}</style>

      <div className="border-b border-surface-200 dark:border-surface-700/60 pb-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_1.6fr] gap-5 md:gap-0">

          {/* ── Zone 1: Activity ── */}
          <div className="md:pr-6 md:border-r md:border-surface-200 md:dark:border-surface-700/60">
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
              Activity
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold font-heading text-[var(--foreground)] tabular-nums leading-none">
                <AnimatedNumber value={totalCount} />
              </span>
              <span className="text-sm text-muted">
                analys{totalCount === 1 ? "is" : "es"}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted">
              {completedCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success-500 shrink-0" />
                  {completedCount} completed
                </span>
              )}
              {pendingCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-surface-400 shrink-0" />
                  {pendingCount} pending
                </span>
              )}
            </div>
          </div>

          {/* ── Zone 2: Event Distribution ── */}
          <div className="md:px-6 md:border-r md:border-surface-200 md:dark:border-surface-700/60">
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
              By Event
            </p>
            {activeEvents.length > 0 ? (
              <div className="space-y-1.5">
                {activeEvents.map(([event, count], i) => (
                  <div key={event} className="flex items-center gap-2">
                    <span className="text-[11px] text-muted w-[4.5rem] shrink-0 truncate">
                      {EVENT_LABELS[event] || event}
                    </span>
                    <div className="flex-1 h-2 rounded-sm overflow-hidden bg-surface-100 dark:bg-surface-800/60">
                      <div
                        className="summary-bar h-full rounded-sm origin-left"
                        style={{
                          width: `${(count / maxEventCount) * 100}%`,
                          backgroundColor: EVENT_COLORS[event] || "var(--primary-500)",
                          animation: `summary-bar-grow 600ms cubic-bezier(0.16,1,0.3,1) ${i * 80}ms both`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-muted w-5 text-right">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">No analyses yet</p>
            )}
          </div>

          {/* ── Zone 3: Latest Insight ── */}
          <div className="md:pl-6">
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
              Latest Analysis
            </p>
            {latestInsight ? (
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-heading font-bold text-[var(--foreground)] truncate">
                    {latestInsight.athleteName}
                  </span>
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      backgroundColor: `${EVENT_COLORS[latestInsight.event] || "#888"}20`,
                      color: EVENT_COLORS[latestInsight.event] || "#888",
                    }}
                  >
                    {EVENT_LABELS[latestInsight.event] || latestInsight.event}
                  </span>
                </div>
                <p className="text-[11px] text-muted truncate mb-2">{latestInsight.title}</p>

                {latestInsight.angles && latestInsight.angles.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {latestInsight.angles.map((angle) => (
                      <div key={angle.key} className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[angle.status]}`} aria-hidden="true" />
                        <span className={`text-[10px] font-bold ${angle.status === "optimal" ? "text-success-500" : angle.status === "marginal" ? "text-warning-500" : "text-danger-500"}`} aria-hidden="true">{STATUS_SYMBOL[angle.status]}</span>
                        <span className="text-[11px] text-muted">{angle.label}</span>
                        <span className="text-xs font-mono tabular-nums text-[var(--foreground)]">
                          {angle.degrees}°
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted">No angle data recorded</p>
                )}

                <Link
                  href={`/coach/video-analysis/${latestInsight.id}`}
                  className="inline-block mt-2 text-[11px] text-primary-500 hover:underline
                    focus-visible:outline-none focus-visible:underline"
                >
                  View analysis →
                </Link>
              </div>
            ) : (
              <p className="text-xs text-muted leading-relaxed">
                Complete an analysis with key positions to see technique insights
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
