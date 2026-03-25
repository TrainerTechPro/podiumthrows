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

const EVENT_META: Record<string, { label: string; color: string }> = {
  SHOT_PUT: { label: "Shot Put", color: "#E85D26" },
  DISCUS: { label: "Discus", color: "#2563EB" },
  HAMMER: { label: "Hammer", color: "#7C3AED" },
  JAVELIN: { label: "Javelin", color: "#059669" },
};

export function DistanceTrendChart({
  chartData,
  eventKeys,
}: {
  chartData: Record<string, unknown>[];
  eventKeys: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={chartData}
        margin={{ top: 4, right: 8, bottom: 4, left: -10 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--card-border)"
          opacity={0.5}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--muted)" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickFormatter={(v: number) => `${v}m`}
        />
        <Tooltip
          formatter={(val: number, name: string) => [
            `${val.toFixed(2)}m`,
            EVENT_META[name]?.label ?? name,
          ]}
          contentStyle={{
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value: string) =>
            EVENT_META[value]?.label ?? value
          }
        />
        {eventKeys.map((ev) => (
          <Line
            key={ev}
            type="monotone"
            dataKey={ev}
            name={ev}
            stroke={EVENT_META[ev]?.color ?? "#666"}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
