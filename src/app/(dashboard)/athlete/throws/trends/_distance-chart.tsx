"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { UnitChoice } from "@/lib/units/types";
import { metersToFtInString } from "@/lib/units/convert";

/**
 * Color palette for implement weights. The competition weight always takes the
 * brand amber accent. Heavier-than-comp weights shift warm (red/orange),
 * lighter-than-comp shifts cool (teal/blue). This keeps the chart readable even
 * when 5+ weights are visible for one event.
 */
const COLOR_COMP = "#FFC800"; // brand amber — competition weight
const COLOR_HEAVY = ["#FF6B2C", "#E63946", "#B7094C"]; // warm tones, heaviest = darkest
const COLOR_LIGHT = ["#22D3EE", "#3B82F6", "#6366F1"]; // cool tones, lightest = deepest

/**
 * Given an event + an implement weight + the athlete's competition weight,
 * return a stable color. This runs client-side and is deterministic so tooltips
 * and legend always match the rendered line.
 */
export function colorForImplement(implementKg: number, compKg: number | null): string {
  if (compKg == null || Math.abs(implementKg - compKg) < 0.01) {
    return COLOR_COMP;
  }
  if (implementKg > compKg) {
    // Rank within "heavy" tier — more above comp = warmer/darker
    const diff = implementKg - compKg;
    const idx = Math.min(COLOR_HEAVY.length - 1, Math.floor(diff));
    return COLOR_HEAVY[idx];
  }
  // Lighter than comp
  const diff = compKg - implementKg;
  const idx = Math.min(COLOR_LIGHT.length - 1, Math.floor(diff));
  return COLOR_LIGHT[idx];
}

/**
 * Compute a tight Y-axis domain from the visible data. Pads 5% of the spread on
 * each side, with a minimum pad of 0.5m so a single data point still renders a
 * sensible range. Returns null when there's no data (caller shows empty state).
 */
export function tightYDomain(values: number[]): [number, number] | null {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min;
  const pad = Math.max(0.5, spread * 0.1);
  return [Math.max(0, Math.floor((min - pad) * 2) / 2), Math.ceil((max + pad) * 2) / 2];
}

interface DistanceTrendChartProps {
  /** Data rows in the shape { date: "Mar 15", "7.26kg": 18.42, "6kg": 19.10, ... }.
   *  Values are pre-converted to the athlete's chosen display unit by the
   *  caller — chart treats them as opaque numbers and just renders. */
  chartData: Record<string, unknown>[];
  /** Implement keys that should render as lines (e.g. ["7.26kg", "6kg"]) */
  implementKeys: string[];
  /** Map of implement label → numeric kg (for color lookup) */
  implementKgMap: Record<string, number>;
  /** Athlete's competition weight for this event, used to color the comp line */
  compKg: number | null;
  /** Optional explicit Y domain; falls back to tight auto-scale */
  yDomain?: [number, number] | null;
  /** Unit the data is in. Drives the Y-axis tick suffix + tooltip format.
   *  metric → values are meters, render as "Xm". imperial → values are feet,
   *  render the tick as "Xft" and the tooltip as ft+in for precision. */
  unit?: UnitChoice;
}

export function DistanceTrendChart({
  chartData,
  implementKeys,
  implementKgMap,
  compKg,
  yDomain,
  unit = "metric",
}: DistanceTrendChartProps) {
  // Compute tight Y-axis from all visible values if not provided
  const autoDomain =
    yDomain ??
    tightYDomain(
      chartData.flatMap((row) =>
        implementKeys.map((k) => row[k]).filter((v): v is number => typeof v === "number")
      )
    );

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" opacity={0.5} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--card-border)" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickFormatter={(v: number) => (unit === "imperial" ? `${Math.round(v)}ft` : `${v}m`)}
          domain={autoDomain ?? ["auto", "auto"]}
          tickLine={false}
          axisLine={{ stroke: "var(--card-border)" }}
          width={unit === "imperial" ? 56 : 48}
        />
        <Tooltip
          formatter={(val: number, name: string) => [
            unit === "imperial"
              ? // Tooltip shows ft+in for precision since the Y-axis tick is rounded feet.
                metersToFtInString(val * 0.3048)
              : `${val.toFixed(2)}m`,
            name,
          ]}
          contentStyle={{
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
        />
        {implementKeys.map((impl) => {
          const kg = implementKgMap[impl] ?? 0;
          const color = colorForImplement(kg, compKg);
          return (
            <Line
              key={impl}
              type="monotone"
              dataKey={impl}
              name={impl}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color }}
              activeDot={{ r: 5, fill: color }}
              connectNulls
              isAnimationActive={false}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
