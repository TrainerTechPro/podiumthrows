"use client";

import { memo } from "react";

interface VolumeMarkOverlayProps {
  weeklyVolume: number[];
  weeklyMarks: number[];
  phases?: Array<{ startWeek: number; endWeek: number; phase: string }>;
}

const PHASE_CSS_CLASSES: Record<string, string> = {
  ACCUMULATION: "fill-blue-500/10",
  TRANSMUTATION: "fill-amber-500/10",
  REALIZATION: "fill-emerald-500/10",
  COMPETITION: "fill-red-500/10",
};

function VolumeMarkOverlay({
  weeklyVolume,
  weeklyMarks,
  phases,
}: VolumeMarkOverlayProps) {
  const weeks = Math.max(weeklyVolume.length, weeklyMarks.length);
  if (weeks === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted">No weekly data yet.</p>
      </div>
    );
  }

  const width = 400;
  const height = 200;
  const padding = { top: 20, right: 50, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Volume scale (left Y)
  const maxVol = Math.max(...weeklyVolume, 1);
  const volStep = chartWidth / weeks;
  const barWidth = Math.min(volStep * 0.6, 20);

  // Mark scale (right Y)
  const nonZeroMarks = weeklyMarks.filter((m) => m > 0);
  const minMark = nonZeroMarks.length > 0 ? Math.floor(Math.min(...nonZeroMarks) - 0.5) : 0;
  const maxMark = nonZeroMarks.length > 0 ? Math.ceil(Math.max(...nonZeroMarks) + 0.5) : 1;
  const markRange = maxMark - minMark || 1;

  const scaleVol = (v: number) =>
    padding.top + chartHeight - (v / maxVol) * chartHeight;
  const scaleMark = (m: number) =>
    padding.top + chartHeight - ((m - minMark) / markRange) * chartHeight;
  const scaleX = (i: number) =>
    padding.left + (i + 0.5) * volStep;

  // Mark line points (only non-zero)
  const markPoints = weeklyMarks
    .map((m, i) => (m > 0 ? `${scaleX(i)},${scaleMark(m)}` : null))
    .filter(Boolean)
    .join(" ");

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={`Volume vs mark overlay chart across ${weeks} weeks`}>
        {/* Phase background regions */}
        {phases?.map((p) => {
          const x1 = padding.left + (p.startWeek - 1) * volStep;
          const x2 = padding.left + p.endWeek * volStep;
          return (
            <rect
              key={`${p.phase}-${p.startWeek}`}
              x={x1}
              y={padding.top}
              width={x2 - x1}
              height={chartHeight}
              className={PHASE_CSS_CLASSES[p.phase] ?? "fill-transparent"}
            />
          );
        })}

        {/* Volume bars */}
        {weeklyVolume.map((vol, i) => (
          <rect
            key={i}
            x={scaleX(i) - barWidth / 2}
            y={scaleVol(vol)}
            width={barWidth}
            height={padding.top + chartHeight - scaleVol(vol)}
            rx={2}
            className="fill-blue-400/60 dark:fill-blue-500/40"
          />
        ))}

        {/* Mark line */}
        {markPoints && (
          <polyline
            points={markPoints}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="text-primary-500"
          />
        )}

        {/* Mark dots */}
        {weeklyMarks.map((m, i) =>
          m > 0 ? (
            <circle
              key={i}
              cx={scaleX(i)}
              cy={scaleMark(m)}
              r={3}
              className="fill-primary-500 stroke-white dark:stroke-[var(--card-bg)]"
              strokeWidth={1.5}
            />
          ) : null,
        )}

        {/* Left Y-axis (Volume) */}
        <text
          x={12}
          y={padding.top + chartHeight / 2}
          textAnchor="middle"
          className="text-[8px] fill-blue-500"
          transform={`rotate(-90, 12, ${padding.top + chartHeight / 2})`}
        >
          Throws/Week
        </text>

        {/* Right Y-axis (Mark) */}
        <text
          x={width - 12}
          y={padding.top + chartHeight / 2}
          textAnchor="middle"
          className="text-[8px] fill-primary-600"
          transform={`rotate(90, ${width - 12}, ${padding.top + chartHeight / 2})`}
        >
          Best Mark (m)
        </text>

        {/* X-axis week labels */}
        {weeklyVolume.map((_, i) => (
          <text
            key={i}
            x={scaleX(i)}
            y={height - 5}
            textAnchor="middle"
            className="text-[8px] fill-muted"
          >
            {i + 1}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-blue-400/60" />
          Volume
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-primary-500" />
          Best Mark
        </span>
      </div>
    </div>
  );
}

export default memo(VolumeMarkOverlay);
