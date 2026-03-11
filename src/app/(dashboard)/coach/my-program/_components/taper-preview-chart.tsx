"use client";

import { memo } from "react";

interface WeekMultiplier {
  weekIndex: number;
  volumeMultiplier: number;
  rationale: string;
}

interface TaperPreviewChartProps {
  taperPlan: {
    weekMultipliers: WeekMultiplier[];
    taperDuration: number;
    rationale: string;
  };
}

function TaperPreviewChart({
  taperPlan,
}: TaperPreviewChartProps) {
  const { weekMultipliers } = taperPlan;
  if (!weekMultipliers || weekMultipliers.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted">Taper plan not available.</p>
      </div>
    );
  }

  const width = 360;
  const height = 160;
  const padding = { top: 15, right: 15, bottom: 30, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxMult = 1;

  const barWidth = chartWidth / weekMultipliers.length - 4;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={`Taper preview chart showing ${taperPlan.taperDuration}-day volume reduction across ${weekMultipliers.length} weeks`}>
        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((val) => {
          const y = padding.top + chartHeight - (val / maxMult) * chartHeight;
          return (
            <g key={val}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeWidth={0.5}
                className="text-[var(--card-border)]"
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                textAnchor="end"
                className="text-[8px] fill-muted"
              >
                {Math.round(val * 100)}%
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path
          d={`
            M ${padding.left} ${padding.top + chartHeight}
            ${weekMultipliers.map((wm, i) => {
              const x = padding.left + i * (chartWidth / weekMultipliers.length) + barWidth / 2;
              const y = padding.top + chartHeight - (wm.volumeMultiplier / maxMult) * chartHeight;
              return `L ${x} ${y}`;
            }).join(" ")}
            L ${padding.left + (weekMultipliers.length - 1) * (chartWidth / weekMultipliers.length) + barWidth / 2} ${padding.top + chartHeight}
            Z
          `}
          fill="currentColor"
          className="text-red-500/10"
        />

        {/* Line */}
        <polyline
          points={weekMultipliers
            .map((wm, i) => {
              const x = padding.left + i * (chartWidth / weekMultipliers.length) + barWidth / 2;
              const y = padding.top + chartHeight - (wm.volumeMultiplier / maxMult) * chartHeight;
              return `${x},${y}`;
            })
            .join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="text-red-500"
        />

        {/* Data points */}
        {weekMultipliers.map((wm, i) => {
          const x = padding.left + i * (chartWidth / weekMultipliers.length) + barWidth / 2;
          const y = padding.top + chartHeight - (wm.volumeMultiplier / maxMult) * chartHeight;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={3} className="fill-red-500 stroke-white dark:stroke-[var(--card-bg)]" strokeWidth={1.5} />
              <text
                x={x}
                y={padding.top + chartHeight + 14}
                textAnchor="middle"
                className="text-[8px] fill-muted"
              >
                Wk {wm.weekIndex + 1}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="text-[11px] text-muted mt-2">
        {taperPlan.taperDuration}-day taper — {taperPlan.rationale}
      </p>
    </div>
  );
}

export default memo(TaperPreviewChart);
