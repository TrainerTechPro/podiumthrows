"use client";

import { LineChart, type LineChartDataPoint } from "@/components/charts/LineChart";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type ImplementSeriesData = {
  implementWeight: number;
  label: string;
  data: { date: string; distance: number }[];
};

/* ─── Color Palette (heavy → light: red → amber → green) ────────────────── */

const SERIES_COLORS = [
  "#ef4444", // red-500 — heaviest
  "#f59e0b", // amber-500 — competition
  "#22c55e", // green-500 — light
  "#3b82f6", // blue-500
  "#a855f7", // purple-500
];

/* ─── Component ──────────────────────────────────────────────────────────── */

export function ImplementComparisonChart({
  seriesData,
}: {
  seriesData: ImplementSeriesData[];
}) {
  if (seriesData.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted h-[180px]">
        No implement data to compare
      </div>
    );
  }

  // Convert to LineChart series format
  const chartSeries = seriesData.map((s, i) => ({
    data: s.data.map(
      (d): LineChartDataPoint => ({
        label: new Date(d.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        value: d.distance,
      })
    ),
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    label: s.label,
  }));

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3">
        {chartSeries.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-xs text-muted">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <LineChart
        series={chartSeries}
        height={200}
        showArea={false}
        formatY={(y) => `${y.toFixed(1)}m`}
      />
    </div>
  );
}
