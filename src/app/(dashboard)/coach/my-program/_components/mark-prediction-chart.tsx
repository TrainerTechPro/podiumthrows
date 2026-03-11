"use client";

import { memo } from "react";

interface MarkPredictionChartProps {
  marks: number[];
  prediction: { a: number; b: number; rSquared: number; predictedMark: number } | null;
  goalDistance?: number;
}

function MarkPredictionChart({
  marks,
  prediction,
  goalDistance,
}: MarkPredictionChartProps) {
  if (marks.length < 3) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted">Need 3+ marks for prediction curve.</p>
        <p className="text-xs text-muted mt-1">
          {marks.length}/3 marks recorded
        </p>
      </div>
    );
  }

  // Chart dimensions
  const width = 400;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Data range
  const allValues = [...marks];
  if (prediction?.predictedMark) allValues.push(prediction.predictedMark);
  if (goalDistance) allValues.push(goalDistance);
  const minY = Math.floor(Math.min(...allValues) - 0.5);
  const maxY = Math.ceil(Math.max(...allValues) + 0.5);
  const yRange = maxY - minY || 1;

  // Scale functions
  const scaleX = (i: number) => padding.left + (i / (prediction ? marks.length + 5 : Math.max(marks.length - 1, 1))) * chartWidth;
  const scaleY = (v: number) => padding.top + chartHeight - ((v - minY) / yRange) * chartHeight;

  // Logarithmic curve points (a * ln(x+1) + b)
  const curvePoints: string[] = [];
  if (prediction) {
    const steps = 50;
    const maxIdx = marks.length + 5; // project a bit forward
    for (let i = 0; i <= steps; i++) {
      const idx = (i / steps) * maxIdx;
      const predicted = prediction.a * Math.log(idx + 1) + prediction.b;
      const x = padding.left + (idx / maxIdx) * chartWidth;
      const y = scaleY(predicted);
      curvePoints.push(`${x},${y}`);
    }
  }

  // Y-axis ticks
  const yTicks: number[] = [];
  const tickStep = yRange <= 5 ? 0.5 : yRange <= 10 ? 1 : 2;
  for (let v = minY; v <= maxY; v += tickStep) {
    yTicks.push(v);
  }

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={`Mark prediction chart showing ${marks.length} recorded marks${prediction ? `, predicted mark ${prediction.predictedMark.toFixed(2)}m` : ""}`}>
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={scaleY(tick)}
              y2={scaleY(tick)}
              stroke="currentColor"
              strokeWidth={0.5}
              className="text-[var(--card-border)]"
            />
            <text
              x={padding.left - 8}
              y={scaleY(tick) + 3}
              textAnchor="end"
              className="text-[9px] fill-muted"
            >
              {tick.toFixed(1)}m
            </text>
          </g>
        ))}

        {/* Goal line */}
        {goalDistance && (
          <g>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={scaleY(goalDistance)}
              y2={scaleY(goalDistance)}
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="6,4"
              className="text-emerald-500"
            />
            <text
              x={width - padding.right}
              y={scaleY(goalDistance) - 4}
              textAnchor="end"
              className="text-[9px] fill-emerald-500 font-medium"
            >
              Goal {goalDistance}m
            </text>
          </g>
        )}

        {/* Prediction curve */}
        {curvePoints.length > 0 && (
          <polyline
            points={curvePoints.join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray="4,4"
            className="text-amber-500/60"
          />
        )}

        {/* Actual marks */}
        {marks.map((mark, i) => (
          <circle
            key={i}
            cx={scaleX(i)}
            cy={scaleY(mark)}
            r={3.5}
            className="fill-[var(--color-gold)] stroke-white dark:stroke-[var(--card-bg)]"
            strokeWidth={1.5}
          />
        ))}

        {/* X-axis label */}
        <text
          x={width / 2}
          y={height - 5}
          textAnchor="middle"
          className="text-[9px] fill-muted"
        >
          Throws Recorded
        </text>
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-gold)]" />
          Actual Marks
        </span>
        {prediction && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0 border-t-2 border-dashed border-amber-500/60" />
            Predicted (R²={prediction.rSquared.toFixed(2)})
          </span>
        )}
        {goalDistance && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0 border-t border-dashed border-emerald-500" />
            Goal
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(MarkPredictionChart);
