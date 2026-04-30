"use client";

import { LineChart } from "@/components/charts/LineChart";
import {
  decimalsForUnit,
  type PerformanceTestTrendPointDTO,
  type PerformanceTestTypeDTO,
} from "@/lib/performance-tests-display";

export interface TestTrendChartProps {
  testType: PerformanceTestTypeDTO;
  points: PerformanceTestTrendPointDTO[];
  height?: number;
}

const PEAK_COLOR = "var(--color-brand)";
const AVG_COLOR = "var(--muted)";

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Two-series line chart: peak (brand color, prominent) and average (muted).
 *
 * `lowerIsBetter` flips the axis label note. We don't invert the y-axis
 * because that would lie about the data — the line going down still means
 * "values decreasing"; the label clarifies which direction is good.
 */
export function TestTrendChart({ testType, points, height = 240 }: TestTrendChartProps) {
  const decimals = decimalsForUnit(testType.unit);

  const peakSeries = points
    .filter((p) => p.peak != null)
    .map((p) => ({ label: shortDate(p.performedAt), value: p.peak as number }));
  const avgSeries = points
    .filter((p) => p.avg != null)
    .map((p) => ({ label: shortDate(p.performedAt), value: p.avg as number }));

  const isEmpty = peakSeries.length === 0 && avgSeries.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: "var(--color-brand)" }}
            />
            Peak
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block w-2.5 h-2.5 rounded-full bg-muted/60"
            />
            Avg
          </span>
        </div>
        <span>
          y: {testType.unit}
          {testType.lowerIsBetter ? " · lower is better" : " · higher is better"}
        </span>
      </div>

      {isEmpty ? (
        <div
          className="flex items-center justify-center text-sm text-muted rounded-xl border border-[var(--card-border)]"
          style={{ height }}
        >
          Not enough data yet
        </div>
      ) : (
        <LineChart
          height={height}
          series={[
            { data: peakSeries, color: PEAK_COLOR, label: "Peak" },
            { data: avgSeries, color: AVG_COLOR, label: "Average" },
          ]}
          formatY={(v) => v.toFixed(decimals)}
        />
      )}
    </div>
  );
}
