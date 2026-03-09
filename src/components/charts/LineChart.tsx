"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { CHART_DEFAULT_COLOR } from "@/lib/design-tokens";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface LineChartDataPoint {
  label: string;
  value: number;
}

export interface LineChartSeries {
  data: LineChartDataPoint[];
  color: string;
  label?: string;
}

export interface LineChartProps {
  /** Single series */
  data?: LineChartDataPoint[];
  /** Multiple series */
  series?: LineChartSeries[];
  height?: number;
  yMin?: number;
  yMax?: number;
  /** Primary color (used for single-series) */
  color?: string;
  showArea?: boolean;
  showDots?: boolean;
  gridLines?: number;
  className?: string;
  formatY?: (v: number) => string;
  /** Called per x-label. Return "" to hide. */
  formatX?: (label: string, index: number, total: number) => string;
  emptyMessage?: string;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const PAD = { top: 12, right: 12, bottom: 36, left: 36 };
const VIEWBOX_W = 800;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function buildPoints(
  data: LineChartDataPoint[],
  chartW: number,
  chartH: number,
  yMin: number,
  yMax: number
) {
  const yRange = yMax - yMin || 1;
  return data.map((d, i) => ({
    x: PAD.left + (i / Math.max(data.length - 1, 1)) * chartW,
    y: PAD.top + (1 - (d.value - yMin) / yRange) * chartH,
    value: d.value,
    label: d.label,
  }));
}

function buildLinePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  return `M ${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")}`;
}

function buildAreaPath(
  pts: { x: number; y: number }[],
  chartBottom: number
): string {
  if (pts.length === 0) return "";
  const bottom = PAD.top + chartBottom;
  return (
    `M ${pts[0].x.toFixed(1)},${bottom.toFixed(1)} ` +
    `L ${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")} ` +
    `L ${pts[pts.length - 1].x.toFixed(1)},${bottom.toFixed(1)} Z`
  );
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function LineChart({
  data,
  series,
  height = 200,
  yMin: yMinProp,
  yMax: yMaxProp,
  color = CHART_DEFAULT_COLOR,
  showArea = true,
  showDots = true,
  gridLines = 4,
  className,
  formatY = (v) => String(Math.round(v)),
  formatX = (label) => label,
  emptyMessage = "No data yet",
}: LineChartProps) {
  const chartW = VIEWBOX_W - PAD.left - PAD.right;
  const chartH = height - PAD.top - PAD.bottom;

  // allSeries/allData computed inside memo so deps are stable prop references
  const { allData, renderedSeries, xLabels, yTicks } = useMemo(() => {
    const allSeries: LineChartSeries[] = series ?? (data ? [{ data, color }] : []);
    const allData = allSeries.flatMap((s) => s.data);

    if (allData.length === 0)
      return { allData, renderedSeries: [], xLabels: [], yTicks: [] };

    const values = allData.map((d) => d.value);
    const yMin = yMinProp ?? Math.max(0, Math.floor(Math.min(...values) - 0.5));
    const yMax = yMaxProp ?? Math.ceil(Math.max(...values) + 0.5);

    const renderedSeries = allSeries.map((s) => ({
      ...s,
      points: buildPoints(s.data, chartW, chartH, yMin, yMax),
    }));

    // X labels from the first series
    const xLabels =
      allSeries[0]?.data.map((d, i) => ({
        x:
          PAD.left +
          (i / Math.max(allSeries[0].data.length - 1, 1)) * chartW,
        label: d.label,
        idx: i,
        total: allSeries[0].data.length,
      })) ?? [];

    const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => {
      const frac = i / gridLines;
      return { value: yMax - (yMax - yMin) * frac, frac };
    });

    return { allData, renderedSeries, xLabels, yTicks };
  }, [data, series, color, yMinProp, yMaxProp, chartW, chartH, gridLines]);

  if (allData.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-sm text-muted",
          className
        )}
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  // Show every Nth x-label to prevent crowding
  const maxLabels = Math.max(2, Math.floor(chartW / 55));
  const labelStep = Math.max(1, Math.ceil(xLabels.length / maxLabels));

  return (
    <div className={cn("w-full select-none", className)}>
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${height}`}
        className="w-full"
        style={{ height }}
        aria-hidden="true"
      >
        {/* Grid */}
        {yTicks.map((tick, i) => {
          const yPos = PAD.top + tick.frac * chartH;
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={yPos}
                x2={PAD.left + chartW}
                y2={yPos}
                stroke="var(--card-border)"
                strokeWidth="1"
                strokeDasharray={tick.frac === 1 ? "0" : "3,3"}
              />
              <text
                x={PAD.left - 6}
                y={yPos + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--muted)"
              >
                {formatY(tick.value)}
              </text>
            </g>
          );
        })}

        {/* Series: area then line then dots */}
        {renderedSeries.map((s, si) => {
          const linePath = buildLinePath(s.points);
          const areaPath =
            showArea && si === 0 ? buildAreaPath(s.points, chartH) : "";
          return (
            <g key={si}>
              {areaPath && (
                <path d={areaPath} fill={s.color} fillOpacity="0.1" stroke="none" />
              )}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {showDots &&
                s.points.map((p, pi) => (
                  <circle
                    key={pi}
                    cx={p.x}
                    cy={p.y}
                    r="3"
                    fill="var(--card-bg)"
                    stroke={s.color}
                    strokeWidth="2"
                  />
                ))}
            </g>
          );
        })}

        {/* X-axis labels */}
        {xLabels.map((x, i) => {
          if (i % labelStep !== 0 && i !== xLabels.length - 1) return null;
          const formatted = formatX(x.label, x.idx, x.total);
          if (!formatted) return null;
          return (
            <text
              key={i}
              x={x.x}
              y={PAD.top + chartH + 22}
              textAnchor="middle"
              fontSize="11"
              fill="var(--muted)"
            >
              {formatted}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
