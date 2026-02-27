"use client";

import { useState, useMemo } from "react";

/* ── Types ─────────────────────────────────────────────────────────────────── */

type TrendPoint = {
  responseId: string;
  athleteId: string;
  athleteName: string;
  compositeScore: number | null;
  maxPossibleScore: number;
  completedAt: string;
};

type Props = {
  trends: TrendPoint[];
};

/* ── Color palette for athlete lines ───────────────────────────────────────── */

const ATHLETE_COLORS = [
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#ef4444", // red
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
];

/* ── SVG Line Chart ────────────────────────────────────────────────────────── */

function TrendLineChart({
  data,
  maxScore,
  athleteNames,
}: {
  data: Map<string, Array<{ date: string; score: number }>>;
  maxScore: number;
  athleteNames: Map<string, string>;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    athlete: string;
    date: string;
    score: number;
    x: number;
    y: number;
  } | null>(null);

  const width = 700;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Collect all dates
  const allDates: string[] = [];
  for (const points of Array.from(data.values())) {
    for (const p of points) {
      if (!allDates.includes(p.date)) allDates.push(p.date);
    }
  }
  allDates.sort();

  if (allDates.length < 2) {
    // Not enough data for a line chart — show bars instead
    return (
      <div className="text-sm text-muted text-center py-4">
        Need at least 2 data points for trend chart.
      </div>
    );
  }

  const xScale = (i: number) =>
    padding.left + (i / (allDates.length - 1)) * chartW;
  const yScale = (v: number) =>
    padding.top + chartH - (v / maxScore) * chartH;

  const athletes = Array.from(data.entries());

  // Y-axis ticks
  const yTicks = [0, Math.round(maxScore / 2), maxScore];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              y1={yScale(tick)}
              x2={width - padding.right}
              y2={yScale(tick)}
              className="stroke-surface-200 dark:stroke-surface-700"
              strokeWidth="1"
              strokeDasharray="4 2"
            />
            <text
              x={padding.left - 6}
              y={yScale(tick) + 4}
              textAnchor="end"
              className="fill-surface-400 dark:fill-surface-500"
              fontSize="10"
            >
              {tick}
            </text>
          </g>
        ))}

        {/* X-axis labels (show first, middle, last) */}
        {[0, Math.floor(allDates.length / 2), allDates.length - 1].map(
          (idx) => (
            <text
              key={idx}
              x={xScale(idx)}
              y={height - 6}
              textAnchor="middle"
              className="fill-surface-400 dark:fill-surface-500"
              fontSize="10"
            >
              {new Date(allDates[idx]).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </text>
          )
        )}

        {/* Lines for each athlete */}
        {athletes.map(([athleteId, points], aIdx) => {
          const color = ATHLETE_COLORS[aIdx % ATHLETE_COLORS.length];
          const sortedPoints = points.sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );

          const pathData = sortedPoints
            .map((p, i) => {
              const dateIdx = allDates.indexOf(p.date);
              const x = xScale(dateIdx);
              const y = yScale(p.score);
              return `${i === 0 ? "M" : "L"} ${x} ${y}`;
            })
            .join(" ");

          return (
            <g key={athleteId}>
              <path
                d={pathData}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {sortedPoints.map((p) => {
                const dateIdx = allDates.indexOf(p.date);
                const x = xScale(dateIdx);
                const y = yScale(p.score);
                return (
                  <circle
                    key={`${athleteId}-${p.date}`}
                    cx={x}
                    cy={y}
                    r="4"
                    fill={color}
                    className="cursor-pointer"
                    onMouseEnter={() =>
                      setHoveredPoint({
                        athlete: athleteNames.get(athleteId) ?? athleteId,
                        date: p.date,
                        score: p.score,
                        x,
                        y,
                      })
                    }
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (
        <div
          className="absolute pointer-events-none bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-lg px-3 py-2 text-xs"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100 - 12}%`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="font-semibold text-[var(--foreground)]">
            {hoveredPoint.athlete}
          </div>
          <div className="text-muted">
            {new Date(hoveredPoint.date).toLocaleDateString()} —{" "}
            <span className="font-medium text-[var(--foreground)]">
              {hoveredPoint.score.toFixed(1)}
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 px-1">
        {athletes.map(([athleteId], aIdx) => (
          <div key={athleteId} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: ATHLETE_COLORS[aIdx % ATHLETE_COLORS.length],
              }}
            />
            <span className="text-xs text-muted">
              {athleteNames.get(athleteId) ?? athleteId}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Chart Component ──────────────────────────────────────────────────── */

export function ResponseTrendChart({ trends }: Props) {
  const [view, setView] = useState<"all" | "athlete">("all");
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);

  // Group by athlete
  const { athleteData, athleteNames, maxScore, uniqueAthletes } =
    useMemo(() => {
      const grouped = new Map<string, Array<{ date: string; score: number }>>();
      const names = new Map<string, string>();
      let max = 0;

      for (const t of trends) {
        if (t.compositeScore === null) continue;

        if (!grouped.has(t.athleteId)) {
          grouped.set(t.athleteId, []);
          names.set(t.athleteId, t.athleteName);
        }
        grouped.get(t.athleteId)!.push({
          date: t.completedAt,
          score: t.compositeScore,
        });
        if (t.maxPossibleScore > max) max = t.maxPossibleScore;
      }

      return {
        athleteData: grouped,
        athleteNames: names,
        maxScore: max,
        uniqueAthletes: Array.from(names.entries()),
      };
    }, [trends]);

  if (athleteData.size === 0) return null;

  // Filter data for display
  const displayData =
    view === "athlete" && selectedAthlete
      ? new Map([[selectedAthlete, athleteData.get(selectedAthlete) ?? []]])
      : athleteData;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Score Trends
        </h3>

        <div className="flex items-center gap-2">
          {uniqueAthletes.length > 1 && (
            <>
              <div className="flex gap-1 p-0.5 bg-surface-100 dark:bg-surface-800 rounded-lg">
                <button
                  onClick={() => {
                    setView("all");
                    setSelectedAthlete(null);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    view === "all"
                      ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
                      : "text-muted hover:text-[var(--foreground)]"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => {
                    setView("athlete");
                    if (!selectedAthlete)
                      setSelectedAthlete(uniqueAthletes[0]?.[0] ?? null);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    view === "athlete"
                      ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
                      : "text-muted hover:text-[var(--foreground)]"
                  }`}
                >
                  By Athlete
                </button>
              </div>

              {view === "athlete" && (
                <select
                  value={selectedAthlete ?? ""}
                  onChange={(e) => setSelectedAthlete(e.target.value)}
                  className="text-xs px-2 py-1 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)]"
                >
                  {uniqueAthletes.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>
      </div>

      <TrendLineChart
        data={displayData}
        maxScore={maxScore}
        athleteNames={athleteNames}
      />
    </div>
  );
}
