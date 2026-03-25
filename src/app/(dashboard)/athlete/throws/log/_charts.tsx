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

const TREND_COLORS = [
  "#E85D26", "#2563EB", "#7C3AED", "#059669",
  "#EC4899", "#EAB308", "#14B8A6", "#F97316",
];

interface TrendSeries {
  key: string;
  drillType: string;
  implement: string;
  points: { date: string; bestMark: number }[];
}

export function BestMarkChart({
  series,
  drillLabel,
  fmtDate,
}: {
  series: TrendSeries[];
  drillLabel: (key: string) => string;
  fmtDate: (d: string) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          type="category"
          allowDuplicatedCategory={false}
          tick={{ fontSize: 11 }}
          tickFormatter={fmtDate}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(val: number) => [`${val.toFixed(2)}m`, ""]}
          labelFormatter={(l) => `Date: ${l}`}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            data={s.points.map((p) => ({ date: fmtDate(p.date), bestMark: p.bestMark }))}
            type="monotone"
            dataKey="bestMark"
            name={`${drillLabel(s.drillType)} ${s.implement}`}
            stroke={TREND_COLORS[i % TREND_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function VolumeChart({
  data,
}: {
  data: { date: string; throws: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(val: number) => [`${val} throws`, "Volume"]} />
        <Line type="monotone" dataKey="throws" stroke="#E85D26" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
