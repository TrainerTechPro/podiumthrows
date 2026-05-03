"use client";

import { MiniSparkline } from "@/components/charts/MiniSparkline";
import { TestIcon } from "./test-icon";
import {
  type PerformanceTestTrendPointDTO,
  type PerformanceTestTypeDTO,
} from "@/lib/performance-tests-display";
import { useTestValueFormatter } from "@/lib/units/test-format";
import { ArrowRight } from "lucide-react";

export interface TestOverviewCardProps {
  testType: PerformanceTestTypeDTO;
  /** Last N trend points, ascending by performedAt. */
  points: PerformanceTestTrendPointDTO[];
  onViewAll: (testType: PerformanceTestTypeDTO) => void;
}

function formatRelative(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} wk${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

/**
 * Coach overview card per test type. Big all-time peak, last-session row,
 * sparkline of the last N peaks, and a "View all" affordance into the trend
 * view. No nested cards.
 */
export function TestOverviewCard({ testType, points, onViewAll }: TestOverviewCardProps) {
  const formatValue = useTestValueFormatter();
  const validPoints = points.filter((p) => p.peak != null) as Array<
    PerformanceTestTrendPointDTO & { peak: number }
  >;
  const allTimePeak = validPoints.length
    ? validPoints.reduce(
        (best, p) =>
          testType.lowerIsBetter ? (p.peak < best.peak ? p : best) : p.peak > best.peak ? p : best,
        validPoints[0]
      )
    : null;
  const lastSession = points.at(-1) ?? null;

  const sparkData = points
    .filter((p) => p.peak != null)
    .map((p) => ({ date: p.performedAt, value: p.peak as number }));

  return (
    <article className="card p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="rounded-md bg-primary-500/10 text-primary-500 p-1.5">
            <TestIcon iconKey={testType.iconKey} size={18} />
          </span>
          <h3 className="font-heading text-base font-semibold text-[var(--foreground)]">
            {testType.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onViewAll(testType)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-500 hover:underline"
        >
          View all
          <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
        </button>
      </header>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            All-time best
          </div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-[var(--foreground)] mt-0.5">
            {allTimePeak ? formatValue(allTimePeak.peak, testType) : "—"}
          </div>
          {allTimePeak && (
            <div className="text-[11px] text-muted mt-0.5">
              {formatRelative(allTimePeak.performedAt)}
            </div>
          )}
        </div>
        <div className="shrink-0">
          <MiniSparkline data={sparkData} width={108} height={44} />
        </div>
      </div>

      {lastSession && (
        <div className="mt-4 pt-3 border-t border-[var(--card-border)] flex items-baseline justify-between text-xs">
          <span className="text-muted">Last session</span>
          <span className="text-[var(--foreground)]">
            <span className="font-mono tabular-nums">
              {lastSession.peak != null ? formatValue(lastSession.peak, testType) : "—"}
            </span>
            {lastSession.avg != null && (
              <span className="text-muted">
                {" · avg "}
                <span className="font-mono tabular-nums">
                  {formatValue(lastSession.avg, testType)}
                </span>
              </span>
            )}
            <span className="text-muted">
              {" · "}
              {lastSession.attemptCount} att
            </span>
            <span className="text-muted">
              {" · "}
              {formatRelative(lastSession.performedAt)}
            </span>
          </span>
        </div>
      )}
    </article>
  );
}
