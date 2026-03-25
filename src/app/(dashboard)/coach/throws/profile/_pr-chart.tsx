"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

const BENCH_OVERLAY_OPTIONS = [
  { key: "squat1RM", label: "Squat 1RM (kg)" },
  { key: "bench1RM", label: "Bench 1RM (kg)" },
  { key: "deadlift1RM", label: "Deadlift 1RM (kg)" },
  { key: "cleanAndJerk1RM", label: "Clean & Jerk (kg)" },
  { key: "snatch1RM", label: "Snatch (kg)" },
  { key: "vo2max", label: "VO\u2082max" },
];

const OVERLAY_COLOR = "#a78bfa";

export function PRProgressionLineChart({
  chartData,
  overlay,
  eventLabel,
  eventColor,
}: {
  chartData: Record<string, unknown>[];
  overlay: string | null;
  eventLabel: string;
  eventColor: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.2)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickFormatter={(v: number) => `${v}m`}
          domain={["auto", "auto"]}
        />
        {overlay && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: OVERLAY_COLOR }}
          />
        )}
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", fontSize: 12 }}
          labelStyle={{ color: "#d1d5db" }}
          formatter={(value: number, name: string) =>
            name === "distance"
              ? [`${value?.toFixed(2)}m`, eventLabel]
              : [value, BENCH_OVERLAY_OPTIONS.find((o) => o.key === name)?.label ?? name]
          }
        />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value: string) =>
            value === "distance"
              ? eventLabel
              : (BENCH_OVERLAY_OPTIONS.find((o) => o.key === value)?.label ?? value)
          }
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="distance"
          stroke={eventColor}
          strokeWidth={2.5}
          dot={{ r: 4, fill: eventColor, strokeWidth: 0 }}
          connectNulls
          activeDot={{ r: 6 }}
        />
        {overlay && (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={overlay}
            stroke={OVERLAY_COLOR}
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={{ r: 3, fill: OVERLAY_COLOR, strokeWidth: 0 }}
            connectNulls
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
