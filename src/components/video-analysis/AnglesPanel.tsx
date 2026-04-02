"use client";

import { useMemo } from "react";
import type { ThrowAngles } from "@/lib/pose-angles";
import { getAnglesWithStatus } from "@/lib/pose-angles";
import { AngleIndicator } from "./AngleIndicator";

/* ─── Types ────────────────────────────────────────────────────────────────── */

type Props = {
  angles: ThrowAngles | null;
  isDetecting: boolean;
};

/* ─── Component ────────────────────────────────────────────────────────────── */

export function AnglesPanel({ angles, isDetecting }: Props) {
  const angleResults = useMemo(() => {
    if (!angles) return [];
    return getAnglesWithStatus(angles);
  }, [angles]);

  if (!isDetecting) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted">
          Enable pose detection to see real-time angle measurements
        </p>
        <p className="text-xs text-surface-500 mt-1">
          Click the skeleton toggle above the video
        </p>
      </div>
    );
  }

  if (!angles || angleResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-muted">Detecting pose…</p>
        <p className="text-xs text-surface-500 mt-1">
          Play or scrub the video to analyze frames
        </p>
      </div>
    );
  }

  // Split into primary (key biomechanical angles) and secondary (individual joints)
  const primaryKeys = ["shoulderSeparation", "hipShoulderDifferential", "blockLegKnee", "rearLegKnee", "trunkLean"];
  const primary = angleResults.filter((a) => primaryKeys.includes(a.key));
  const secondary = angleResults.filter((a) => !primaryKeys.includes(a.key));

  return (
    <div className="space-y-4">
      {/* Primary biomechanical angles */}
      <div>
        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
          Biomechanics
        </p>
        <div className="grid grid-cols-2 gap-2">
          {primary.map((angle) => (
            <AngleIndicator
              key={angle.key}
              label={angle.label}
              degrees={angle.degrees}
              status={angle.status}
              optimalRange={angle.optimalRange}
            />
          ))}
        </div>
      </div>

      {/* Secondary joint angles */}
      <div>
        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
          Joint Angles
        </p>
        <div className="space-y-1">
          {secondary.map((angle) => (
            <AngleIndicator
              key={angle.key}
              label={angle.label}
              degrees={angle.degrees}
              status={angle.status}
              optimalRange={angle.optimalRange}
              compact
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 pt-2 border-t border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-success-500" />
          <span className="text-[10px] text-muted">Optimal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-warning-500" />
          <span className="text-[10px] text-muted">Marginal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-danger-500" />
          <span className="text-[10px] text-muted">Concerning</span>
        </div>
      </div>
    </div>
  );
}
