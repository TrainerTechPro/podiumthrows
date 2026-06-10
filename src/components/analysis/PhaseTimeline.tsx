"use client";

import { useMemo } from "react";
import type { PhaseBoundary } from "@/lib/contracts";

/**
 * Phase timeline scrubber (F8): colored phase segments over a frame slider.
 * Phase colors are per-event domain colors (hex allowlisted for
 * src/components/video-analysis — this module continues that allowance via
 * CSS vars where possible; segments use opacity steps of the brand token).
 */

const PHASE_OPACITY: Record<string, string> = {
  entry: "bg-primary-500/20",
  drive: "bg-primary-500/40",
  power_position: "bg-primary-500/90",
  delivery: "bg-primary-500/60",
  recovery: "bg-primary-500/10",
};

export function PhaseTimeline({
  phaseBoundaries,
  frameCount,
  frame,
  onSeek,
}: {
  phaseBoundaries: PhaseBoundary[];
  frameCount: number;
  frame: number;
  onSeek: (frame: number) => void;
}) {
  const segments = useMemo(
    () =>
      phaseBoundaries.map((p) => ({
        ...p,
        left: (p.startFrame / Math.max(1, frameCount - 1)) * 100,
        width:
          ((p.endFrame - p.startFrame + 1) / Math.max(1, frameCount - 1)) * 100,
      })),
    [phaseBoundaries, frameCount]
  );

  return (
    <div className="space-y-1">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-200 dark:bg-surface-800">
        {segments.map((s) => (
          <div
            key={`${s.phase}-${s.startFrame}`}
            className={`absolute top-0 h-full ${PHASE_OPACITY[s.phase] ?? "bg-primary-500/30"}`}
            style={{ left: `${s.left}%`, width: `${Math.max(s.width, 0.8)}%` }}
            title={s.phase.replace(/_/g, " ")}
          />
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(0, frameCount - 1)}
        value={frame}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="w-full accent-primary-500"
        aria-label="Scrub frames"
      />
    </div>
  );
}
