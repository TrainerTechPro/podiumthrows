"use client";

import { useMemo, memo } from "react";

interface DeficitAttribution {
  type: string;
  confidence: number;
  evidence: string;
  suggestedAction: string;
}

interface DeficitAttributionPanelProps {
  deficits: DeficitAttribution[];
}

const TYPE_LABELS: Record<string, string> = {
  STRENGTH: "Strength Deficit",
  TECHNICAL: "Technical Deficit",
  RECOVERY: "Recovery Deficit",
  VOLUME: "Volume Deficit",
  EXERCISE_SELECTION: "Exercise Selection",
};

const TYPE_COLORS: Record<string, string> = {
  STRENGTH: "bg-red-500",
  TECHNICAL: "bg-blue-500",
  RECOVERY: "bg-purple-500",
  VOLUME: "bg-amber-500",
  EXERCISE_SELECTION: "bg-emerald-500",
};

function DeficitAttributionPanel({
  deficits,
}: DeficitAttributionPanelProps) {
  // M6-D: Memoize sort to avoid re-sorting on every parent re-render
  const sorted = useMemo(
    () => deficits?.length ? [...deficits].sort((a, b) => b.confidence - a.confidence) : [],
    [deficits],
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted">No deficit data yet — log more sessions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((d) => {
        const pct = Math.round(d.confidence * 100);
        const label = TYPE_LABELS[d.type] ?? d.type;
        return (
          <div key={d.type} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--foreground)]">
                {label}
              </span>
              <span className="text-xs text-muted tabular-nums">
                {pct}%
              </span>
            </div>
            <div
              className="h-2 bg-[var(--muted-bg)] rounded-full overflow-hidden"
              role="meter"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${label} confidence: ${pct}%`}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${TYPE_COLORS[d.type] ?? "bg-surface-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[11px] text-muted">{d.evidence}</p>
          </div>
        );
      })}
    </div>
  );
}

export default memo(DeficitAttributionPanel);
