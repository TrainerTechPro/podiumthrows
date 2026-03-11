"use client";

import { memo } from "react";

interface AdaptationProgressGaugeProps {
  progress: number; // 0-100
  phase: string;
  label: string;
}

function AdaptationProgressGauge({
  progress,
  phase,
  label,
}: AdaptationProgressGaugeProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  // Color based on progress
  const getColor = () => {
    if (clampedProgress >= 80) return "text-emerald-500";
    if (clampedProgress >= 50) return "text-amber-500";
    return "text-blue-500";
  };

  return (
    <div className="flex flex-col items-center gap-3" role="meter" aria-valuenow={clampedProgress} aria-valuemin={0} aria-valuemax={100} aria-label={`Adaptation progress: ${Math.round(clampedProgress)}% — ${phase} phase, ${label}`}>
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
          {/* Background arc */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-[var(--muted-bg)]"
          />
          {/* Progress arc */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`transition-all duration-700 ${getColor()}`}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-heading text-[var(--foreground)] tabular-nums">
            {Math.round(clampedProgress)}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-[var(--foreground)] capitalize">{phase}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

export default memo(AdaptationProgressGauge);
