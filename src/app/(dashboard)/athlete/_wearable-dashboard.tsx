// src/app/(dashboard)/athlete/_wearable-dashboard.tsx

import { TrendingUp, TrendingDown } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { LineChart } from "@/components/charts/LineChart";
import {
  type WhoopRow,
  type OuraRow,
  scoreColor,
  scoreLabel,
  spo2Color,
  skinTempColor,
  formatMs,
  formatSec,
  formatDate,
  trendDelta,
} from "./_wearable-helpers";

// ─── Props ────────────────────────────────────────────────────────────────────

interface WearableDashboardProps {
  device: "whoop" | "oura";
  today: WhoopRow | OuraRow | null;
  history: (WhoopRow | OuraRow)[];
  averages: Record<string, number | null>;
  lastSyncAt: Date | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortDay(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

/** Trend arrow: show if |delta| > 2% of avg. Invert for RHR (lower is better). */
function TrendArrow({
  current,
  average,
  invert,
}: {
  current: number | null;
  average: number | null;
  invert?: boolean;
}) {
  const delta = trendDelta(current, average);
  if (delta === null || average === null || average === 0) return null;
  const pct = Math.abs(delta / average) * 100;
  if (pct <= 2) return null;

  const isPositive = delta > 0;
  const isGood = invert ? !isPositive : isPositive;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[9px] font-medium ${
        isGood
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-amber-600 dark:text-amber-400"
      }`}
    >
      {isPositive ? (
        <TrendingUp size={10} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <TrendingDown size={10} strokeWidth={1.75} aria-hidden="true" />
      )}
      {Math.abs(delta).toFixed(Number.isInteger(delta) ? 0 : 1)}
    </span>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ device }: { device: "whoop" | "oura" }) {
  const name = device === "whoop" ? "WHOOP" : "Oura";
  const body =
    device === "whoop"
      ? "Data will appear here after your first recovery is scored. Make sure your WHOOP strap is connected and syncing."
      : "Data will appear here after your first readiness score. Make sure your Oura Ring is connected and syncing.";
  return (
    <div className="card p-8 text-center space-y-2">
      <p className="text-lg font-heading font-semibold text-[var(--foreground)]">
        No {name} data yet
      </p>
      <p className="text-sm text-muted">{body}</p>
    </div>
  );
}

// ─── Hero Banner ──────────────────────────────────────────────────────────────

function HeroBanner({
  device,
  today,
  averages,
}: {
  device: "whoop" | "oura";
  today: WhoopRow | OuraRow;
  averages: Record<string, number | null>;
}) {
  const isWhoop = device === "whoop";
  const score = isWhoop
    ? (today as WhoopRow).recoveryScore
    : (today as OuraRow).readinessScore;

  const avgKey = isWhoop ? "recoveryScore" : "readinessScore";
  const delta = trendDelta(score, averages[avgKey] ?? null);

  const gradient = isWhoop
    ? "bg-gradient-to-br from-emerald-500/10 via-[var(--card-bg)] to-[var(--card-bg)]"
    : "bg-gradient-to-br from-violet-500/10 via-[var(--card-bg)] to-[var(--card-bg)]";

  return (
    <div
      className={`card ${gradient} border border-[var(--card-border)] p-6 flex items-center justify-between`}
    >
      <div>
        <p className="text-sm font-semibold text-muted uppercase tracking-wider">
          {isWhoop ? "Today\u2019s Recovery" : "Today\u2019s Readiness"}
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          <AnimatedNumber
            value={score ?? 0}
            decimals={0}
            className={`text-4xl font-heading font-bold ${scoreColor(score)}`}
          />
          <span className={`text-lg ${scoreColor(score)}`}>%</span>
        </div>
        <p className={`text-sm font-medium mt-0.5 ${scoreColor(score)}`}>
          {scoreLabel(score)}
        </p>
      </div>

      {delta !== null && (
        <div className="text-right">
          <p
            className={`text-sm font-semibold tabular-nums ${
              delta >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {delta >= 0 ? "+" : ""}
            {delta} vs 7d avg
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Two-Up Cards ─────────────────────────────────────────────────────────────

function TwoUpCards({
  device,
  today,
}: {
  device: "whoop" | "oura";
  today: WhoopRow | OuraRow;
}) {
  if (device === "whoop") {
    const w = today as WhoopRow;
    const strainPct = w.strain !== null ? Math.min((w.strain / 21) * 100, 100) : 0;
    return (
      <div className="grid grid-cols-2 gap-3">
        {/* Strain */}
        <div className="card p-4 space-y-2">
          <p className="text-sm font-semibold text-muted uppercase tracking-wider">
            Strain
          </p>
          <div className="flex items-baseline gap-1">
            <AnimatedNumber
              value={w.strain ?? 0}
              decimals={1}
              className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums"
            />
            <span className="text-sm text-muted">/21</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500"
              style={{ width: `${strainPct}%` }}
            />
          </div>
        </div>

        {/* Sleep */}
        <div className="card p-4 space-y-2">
          <p className="text-sm font-semibold text-muted uppercase tracking-wider">
            Sleep
          </p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
            {w.sleepDurationMs !== null ? formatMs(w.sleepDurationMs) : "--"}
          </p>
          <p className="text-xs text-muted">
            {w.sleepEfficiency !== null
              ? `${w.sleepEfficiency.toFixed(0)}% efficiency`
              : "No data"}
          </p>
        </div>
      </div>
    );
  }

  // Oura
  const o = today as OuraRow;
  const sleepPct = o.sleepScore !== null ? Math.min(o.sleepScore, 100) : 0;
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Sleep Score */}
      <div className="card p-4 space-y-2">
        <p className="text-sm font-semibold text-muted uppercase tracking-wider">
          Sleep Score
        </p>
        <div className="flex items-baseline gap-1">
          <AnimatedNumber
            value={o.sleepScore ?? 0}
            decimals={0}
            className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums"
          />
          <span className="text-sm text-muted">%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-500"
            style={{ width: `${sleepPct}%` }}
          />
        </div>
      </div>

      {/* Activity */}
      <div className="card p-4 space-y-2">
        <p className="text-sm font-semibold text-muted uppercase tracking-wider">
          Activity
        </p>
        <div className="flex items-baseline gap-1">
          <AnimatedNumber
            value={o.activityScore ?? 0}
            decimals={0}
            className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums"
          />
        </div>
        <p className="text-xs text-muted">
          {o.activityScore !== null && o.activityScore >= 100
            ? "Goal Reached"
            : "In Progress"}
        </p>
      </div>
    </div>
  );
}

// ─── Vitals Strip ─────────────────────────────────────────────────────────────

interface VitalCell {
  label: string;
  value: number | null;
  decimals: number;
  suffix: string;
  prefix?: string;
  colorFn?: (v: number | null) => string;
  average: number | null;
  invertTrend?: boolean;
}

function VitalsStrip({
  device,
  today,
  averages,
}: {
  device: "whoop" | "oura";
  today: WhoopRow | OuraRow;
  averages: Record<string, number | null>;
}) {
  let cells: VitalCell[];

  if (device === "whoop") {
    const w = today as WhoopRow;
    cells = [
      { label: "HRV", value: w.hrvMs, decimals: 0, suffix: "ms", average: averages.hrvMs ?? null },
      { label: "RHR", value: w.restingHR, decimals: 0, suffix: "bpm", average: averages.restingHR ?? null, invertTrend: true },
      { label: "SpO2", value: w.spo2, decimals: 1, suffix: "%", colorFn: spo2Color, average: averages.spo2 ?? null },
      {
        label: "Skin Temp",
        value: w.skinTempC,
        decimals: 1,
        suffix: "\u00B0C",
        prefix: w.skinTempC !== null ? (w.skinTempC >= 0 ? "+" : "") : undefined,
        colorFn: skinTempColor,
        average: averages.skinTempC ?? null,
      },
      { label: "Sleep Perf", value: w.sleepPerformance, decimals: 0, suffix: "%", average: averages.sleepPerformance ?? null },
    ];
  } else {
    const o = today as OuraRow;
    cells = [
      { label: "HRV", value: o.hrvMs, decimals: 0, suffix: "ms", average: averages.hrvMs ?? null },
      { label: "RHR", value: o.restingHR, decimals: 0, suffix: "bpm", average: averages.restingHR ?? null, invertTrend: true },
      { label: "SpO2", value: o.spo2, decimals: 1, suffix: "%", colorFn: spo2Color, average: averages.spo2 ?? null },
      {
        label: "Temp Dev",
        value: o.temperatureDeviation,
        decimals: 1,
        suffix: "\u00B0C",
        prefix: o.temperatureDeviation !== null ? (o.temperatureDeviation >= 0 ? "+" : "") : undefined,
        colorFn: skinTempColor,
        average: averages.temperatureDeviation ?? null,
      },
    ];
  }

  const cols = device === "whoop" ? "grid-cols-5" : "grid-cols-4";

  return (
    <div className={`grid ${cols} gap-1 sm:gap-3`}>
      {cells.map((c) => {
        const colorClass = c.colorFn
          ? c.colorFn(c.value)
          : "text-[var(--foreground)]";
        return (
          <div key={c.label} className="card p-2 sm:p-3 text-center space-y-0.5">
            <p className="text-[9px] uppercase tracking-wider text-muted font-semibold">
              {c.label}
            </p>
            <div className={`font-bold tabular-nums ${colorClass}`}>
              {c.value !== null ? (
                <>
                  {c.prefix && <span className="text-xs">{c.prefix}</span>}
                  <AnimatedNumber
                    value={c.value}
                    decimals={c.decimals}
                    className="text-lg"
                  />
                  <span className="text-[10px] text-muted ml-0.5">
                    {c.suffix}
                  </span>
                </>
              ) : (
                <span className="text-lg text-surface-400">--</span>
              )}
            </div>
            <TrendArrow
              current={c.value}
              average={c.average}
              invert={c.invertTrend}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Sleep Stages ─────────────────────────────────────────────────────────────

function SleepStages({
  device,
  today,
}: {
  device: "whoop" | "oura";
  today: WhoopRow | OuraRow;
}) {
  let light: number;
  let deep: number;
  let rem: number;
  let lightLabel: string;
  let deepLabel: string;
  let remLabel: string;

  if (device === "whoop") {
    const w = today as WhoopRow;
    light = w.lightSleepMs ?? 0;
    deep = w.swsSleepMs ?? 0;
    rem = w.remSleepMs ?? 0;
    lightLabel = formatMs(light);
    deepLabel = formatMs(deep);
    remLabel = formatMs(rem);
  } else {
    const o = today as OuraRow;
    light = o.lightSleepSec ?? 0;
    deep = o.deepSleepSec ?? 0;
    rem = o.remSleepSec ?? 0;
    lightLabel = formatSec(light);
    deepLabel = formatSec(deep);
    remLabel = formatSec(rem);
  }

  const total = light + deep + rem;
  if (total === 0) return null;

  const lightPct = (light / total) * 100;
  const deepPct = (deep / total) * 100;
  const remPct = (rem / total) * 100;

  return (
    <div className="card p-4 space-y-3">
      <p className="text-sm font-semibold text-muted uppercase tracking-wider">
        Sleep Stages
      </p>

      {/* Stacked bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
        <div
          className="bg-blue-400 rounded-full"
          style={{ width: `${lightPct}%` }}
        />
        <div
          className="bg-indigo-500 rounded-full"
          style={{ width: `${deepPct}%` }}
        />
        <div
          className="bg-purple-500 rounded-full"
          style={{ width: `${remPct}%` }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          Light {lightLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          Deep {deepLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          REM {remLabel}
        </span>
      </div>
    </div>
  );
}

// ─── 7-Day Trend Chart ────────────────────────────────────────────────────────

function TrendChart({
  device,
  history,
}: {
  device: "whoop" | "oura";
  history: (WhoopRow | OuraRow)[];
}) {
  const last7 = history.slice(0, 7).reverse();
  if (last7.length === 0) return null;

  const isWhoop = device === "whoop";

  const series1Data = last7.map((row) => ({
    label: shortDay(row.date),
    value: isWhoop
      ? (row as WhoopRow).recoveryScore ?? 0
      : (row as OuraRow).readinessScore ?? 0,
  }));

  const series2Data = last7.map((row) => ({
    label: shortDay(row.date),
    value: isWhoop
      ? (row as WhoopRow).strain ?? 0
      : (row as OuraRow).sleepScore ?? 0,
  }));

  const s1Color = isWhoop ? "#34d399" : "#a78bfa";
  const s2Color = isWhoop ? "#f59e0b" : "#818cf8";
  const s1Label = isWhoop ? "Recovery" : "Readiness";
  const s2Label = isWhoop ? "Strain" : "Sleep Score";

  return (
    <div className="card p-4 space-y-3">
      <p className="text-sm font-semibold text-muted uppercase tracking-wider">
        7-Day Trend
      </p>
      <LineChart
        series={[
          { data: series1Data, color: s1Color, label: s1Label },
          { data: series2Data, color: s2Color, label: s2Label },
        ]}
        height={180}
        showArea={true}
        showDots={true}
      />
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: s1Color }}
          />
          {s1Label}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: s2Color }}
          />
          {s2Label}
        </span>
      </div>
    </div>
  );
}

// ─── 7-Day Averages ───────────────────────────────────────────────────────────

function AveragesCard({
  device,
  averages,
}: {
  device: "whoop" | "oura";
  averages: Record<string, number | null>;
}) {
  const isWhoop = device === "whoop";

  interface AvgRow {
    label: string;
    value: number | null;
    suffix: string;
    decimals: number;
    colorFn?: (v: number | null) => string;
  }

  const rows: AvgRow[] = isWhoop
    ? [
        { label: "Recovery", value: averages.recoveryScore ?? null, suffix: "%", decimals: 0, colorFn: scoreColor },
        { label: "HRV", value: averages.hrvMs ?? null, suffix: "ms", decimals: 0 },
        { label: "RHR", value: averages.restingHR ?? null, suffix: "bpm", decimals: 0 },
        { label: "SpO2", value: averages.spo2 ?? null, suffix: "%", decimals: 1 },
        { label: "Skin Temp", value: averages.skinTempC ?? null, suffix: "\u00B0C", decimals: 1 },
        { label: "Strain", value: averages.strain ?? null, suffix: "", decimals: 1 },
        { label: "Sleep", value: averages.sleepDurationMs ?? null, suffix: "", decimals: 0 },
        { label: "Sleep Eff", value: averages.sleepEfficiency ?? null, suffix: "%", decimals: 0 },
      ]
    : [
        { label: "Readiness", value: averages.readinessScore ?? null, suffix: "", decimals: 0, colorFn: scoreColor },
        { label: "HRV", value: averages.hrvMs ?? null, suffix: "ms", decimals: 0 },
        { label: "RHR", value: averages.restingHR ?? null, suffix: "bpm", decimals: 0 },
        { label: "SpO2", value: averages.spo2 ?? null, suffix: "%", decimals: 1 },
        { label: "Temp Dev", value: averages.temperatureDeviation ?? null, suffix: "\u00B0C", decimals: 1 },
        { label: "Sleep Score", value: averages.sleepScore ?? null, suffix: "", decimals: 0 },
        { label: "Sleep Dur", value: averages.sleepDurationSec ?? null, suffix: "", decimals: 0 },
        { label: "Activity", value: averages.activityScore ?? null, suffix: "", decimals: 0 },
      ];

  function formatAvgValue(row: AvgRow): string {
    if (row.value === null) return "--";
    // Special formatting for sleep duration
    if (row.label === "Sleep" && isWhoop) return formatMs(row.value);
    if (row.label === "Sleep Dur" && !isWhoop) return formatSec(row.value);
    return `${row.value.toFixed(row.decimals)}${row.suffix ? ` ${row.suffix}` : ""}`;
  }

  return (
    <div className="card p-0 space-y-0">
      <p className="text-sm font-semibold text-muted uppercase tracking-wider px-4 pt-4 pb-2">
        7-Day Averages
      </p>
      <div className="divide-y divide-[var(--card-border)]">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between py-2 px-4"
          >
            <span className="text-sm text-muted">{row.label}</span>
            <span
              className={`text-sm font-bold tabular-nums ${
                row.colorFn
                  ? row.colorFn(row.value)
                  : "text-[var(--foreground)]"
              }`}
            >
              {formatAvgValue(row)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── History Table ────────────────────────────────────────────────────────────

function HistoryTable({
  device,
  history,
}: {
  device: "whoop" | "oura";
  history: (WhoopRow | OuraRow)[];
}) {
  if (history.length === 0) return null;
  const isWhoop = device === "whoop";

  const headers = isWhoop
    ? ["Date", "Recovery", "HRV", "RHR", "SpO2", "Skin Temp", "Sleep", "Efficiency", "Strain"]
    : ["Date", "Readiness", "HRV", "RHR", "SpO2", "Temp Dev", "Sleep Score", "Sleep Dur", "Activity"];

  const thClass =
    "px-4 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap";
  const tdClass = "px-4 py-2.5 text-sm tabular-nums whitespace-nowrap";

  return (
    <div className="card p-0 overflow-hidden">
      <p className="text-sm font-semibold text-muted uppercase tracking-wider px-4 pt-4 pb-2">
        History
      </p>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto custom-scrollbar">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--card-border)]">
              {headers.map((h) => (
                <th key={h} className={thClass}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--card-border)] last:border-0 hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors"
              >
                {isWhoop
                  ? (() => {
                      const w = row as WhoopRow;
                      return (
                        <>
                          <td className={tdClass}>{formatDate(w.date)}</td>
                          <td className={`${tdClass} font-semibold ${scoreColor(w.recoveryScore)}`}>
                            {w.recoveryScore !== null ? `${w.recoveryScore}%` : "--"}
                          </td>
                          <td className={tdClass}>{w.hrvMs !== null ? `${w.hrvMs.toFixed(0)} ms` : "--"}</td>
                          <td className={tdClass}>{w.restingHR !== null ? `${w.restingHR.toFixed(0)} bpm` : "--"}</td>
                          <td className={tdClass}>{w.spo2 !== null ? `${w.spo2.toFixed(1)}%` : "--"}</td>
                          <td className={tdClass}>
                            {w.skinTempC !== null
                              ? `${w.skinTempC >= 0 ? "+" : ""}${w.skinTempC.toFixed(1)}\u00B0C`
                              : "--"}
                          </td>
                          <td className={tdClass}>{w.sleepDurationMs !== null ? formatMs(w.sleepDurationMs) : "--"}</td>
                          <td className={tdClass}>{w.sleepEfficiency !== null ? `${w.sleepEfficiency.toFixed(0)}%` : "--"}</td>
                          <td className={tdClass}>{w.strain !== null ? w.strain.toFixed(1) : "--"}</td>
                        </>
                      );
                    })()
                  : (() => {
                      const o = row as OuraRow;
                      return (
                        <>
                          <td className={tdClass}>{formatDate(o.date)}</td>
                          <td className={`${tdClass} font-semibold ${scoreColor(o.readinessScore)}`}>
                            {o.readinessScore !== null ? `${o.readinessScore}` : "--"}
                          </td>
                          <td className={tdClass}>{o.hrvMs !== null ? `${o.hrvMs.toFixed(0)} ms` : "--"}</td>
                          <td className={tdClass}>{o.restingHR !== null ? `${o.restingHR.toFixed(0)} bpm` : "--"}</td>
                          <td className={tdClass}>{o.spo2 !== null ? `${o.spo2.toFixed(1)}%` : "--"}</td>
                          <td className={tdClass}>
                            {o.temperatureDeviation !== null
                              ? `${o.temperatureDeviation >= 0 ? "+" : ""}${o.temperatureDeviation.toFixed(1)}\u00B0C`
                              : "--"}
                          </td>
                          <td className={tdClass}>{o.sleepScore !== null ? `${o.sleepScore}` : "--"}</td>
                          <td className={tdClass}>{o.sleepDurationSec !== null ? formatSec(o.sleepDurationSec) : "--"}</td>
                          <td className={tdClass}>{o.activityScore !== null ? `${o.activityScore}` : "--"}</td>
                        </>
                      );
                    })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden divide-y divide-[var(--card-border)]">
        {history.map((row) => {
          if (isWhoop) {
            const w = row as WhoopRow;
            return (
              <div key={row.id} className="px-4 py-3 space-y-2">
                {/* Date + Recovery score header */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {formatDate(w.date)}
                  </span>
                  <span className={`text-sm font-semibold tabular-nums ${scoreColor(w.recoveryScore)}`}>
                    {w.recoveryScore !== null ? `${w.recoveryScore}%` : "--"}
                  </span>
                </div>
                {/* Vitals grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">HRV</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      {w.hrvMs !== null ? `${w.hrvMs.toFixed(0)} ms` : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">RHR</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      {w.restingHR !== null ? `${w.restingHR.toFixed(0)} bpm` : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">SpO2</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      {w.spo2 !== null ? `${w.spo2.toFixed(1)}%` : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">Skin Temp</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      {w.skinTempC !== null
                        ? `${w.skinTempC >= 0 ? "+" : ""}${w.skinTempC.toFixed(1)}\u00B0C`
                        : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">Sleep</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      {w.sleepDurationMs !== null ? formatMs(w.sleepDurationMs) : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">Efficiency</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      {w.sleepEfficiency !== null ? `${w.sleepEfficiency.toFixed(0)}%` : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">Strain</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      {w.strain !== null ? w.strain.toFixed(1) : "--"}
                    </span>
                  </div>
                </div>
              </div>
            );
          } else {
            const o = row as OuraRow;
            return (
              <div key={row.id} className="px-4 py-3 space-y-2">
                {/* Date + Readiness score header */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {formatDate(o.date)}
                  </span>
                  <span className={`text-sm font-semibold tabular-nums ${scoreColor(o.readinessScore)}`}>
                    {o.readinessScore !== null ? `${o.readinessScore}` : "--"}
                  </span>
                </div>
                {/* Vitals grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">HRV</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      {o.hrvMs !== null ? `${o.hrvMs.toFixed(0)} ms` : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">RHR</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      {o.restingHR !== null ? `${o.restingHR.toFixed(0)} bpm` : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">SpO2</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      {o.spo2 !== null ? `${o.spo2.toFixed(1)}%` : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">Temp Dev</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      {o.temperatureDeviation !== null
                        ? `${o.temperatureDeviation >= 0 ? "+" : ""}${o.temperatureDeviation.toFixed(1)}\u00B0C`
                        : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">Sleep Score</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      {o.sleepScore !== null ? `${o.sleepScore}` : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">Sleep Dur</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      {o.sleepDurationSec !== null ? formatSec(o.sleepDurationSec) : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">Activity</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      {o.activityScore !== null ? `${o.activityScore}` : "--"}
                    </span>
                  </div>
                </div>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WearableDashboard({
  device,
  today,
  history,
  averages,
  lastSyncAt,
}: WearableDashboardProps) {
  const hasData = history.length > 0 || today !== null;

  if (!hasData) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <ScrollProgressBar />
        <EmptyState device={device} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <ScrollProgressBar />

      {/* Hero Banner */}
      {today && (
        <HeroBanner device={device} today={today} averages={averages} />
      )}

      <StaggeredList staggerDelay={60} className="space-y-5">
        {/* Two-Up Cards */}
        {today && (
          <div>
            <TwoUpCards device={device} today={today} />
          </div>
        )}

        {/* Vitals Strip */}
        {today && (
          <div>
            <VitalsStrip device={device} today={today} averages={averages} />
          </div>
        )}

        {/* Sleep Stages */}
        {today && (
          <div>
            <SleepStages device={device} today={today} />
          </div>
        )}

        {/* 7-Day Trend Chart */}
        {history.length > 0 && (
          <div>
            <TrendChart device={device} history={history} />
          </div>
        )}

        {/* 7-Day Averages */}
        {history.length > 0 && (
          <div>
            <AveragesCard device={device} averages={averages} />
          </div>
        )}

        {/* History Table */}
        {history.length > 0 && (
          <div>
            <HistoryTable device={device} history={history} />
          </div>
        )}
      </StaggeredList>

      {/* Last sync timestamp */}
      {lastSyncAt && (
        <p className="text-xs text-muted text-center">
          Last synced {lastSyncAt.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </p>
      )}
    </div>
  );
}
