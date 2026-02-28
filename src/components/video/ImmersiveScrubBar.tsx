"use client";

import { useCallback } from "react";
import { JogWheel } from "./JogWheel";
import { FRAME_STEP, snapToFrame, formatTimestamp } from "./types";
import type { Annotation } from "./types";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  currentTime: number;
  duration: number;
  annotations: Annotation[];
  onSeek: (time: number) => void;
  className?: string;
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function ImmersiveScrubBar({
  currentTime,
  duration,
  annotations,
  onSeek,
  className,
}: Props) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Snap to exact 60fps frame boundary for precise analysis
      const rawTime = parseFloat(e.target.value);
      const exactFrameTime = snapToFrame(rawTime);
      onSeek(exactFrameTime);
    },
    [onSeek]
  );

  return (
    <div className={`w-full px-4 ${className ?? ""}`}>
      {/* ── Scrub bar ─────────────────────────────────────────────────── */}
      <div className="relative group/scrub">
        {/* Background track */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-white/20 rounded-full pointer-events-none group-hover/scrub:h-2 transition-all" />

        {/* Filled track */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-primary-500 rounded-full pointer-events-none group-hover/scrub:h-2 transition-all"
          style={{ width: `${progress}%` }}
        />

        {/* Annotation markers */}
        {annotations.map((ann) => {
          const pos = duration > 0 ? (ann.timestamp / duration) * 100 : 0;
          return (
            <div
              key={ann.id}
              className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-primary-400 rounded-full pointer-events-none z-[1]"
              style={{ left: `${pos}%` }}
              title={`Annotation at ${formatTimestamp(ann.timestamp)}`}
            />
          );
        })}

        {/* Range input */}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={FRAME_STEP}
          value={currentTime}
          onChange={handleScrub}
          className="relative w-full opacity-0 h-6 cursor-pointer"
          aria-label="Scrub video timeline"
        />
      </div>

      {/* ── Timestamp ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center mt-1">
        <span className="text-[10px] font-mono tabular-nums text-white/60">
          {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
        </span>
      </div>

      {/* ── Jog Wheel ─────────────────────────────────────────────────── */}
      <JogWheel
        currentTime={currentTime}
        duration={duration}
        onSeek={onSeek}
        className="mt-1"
      />
    </div>
  );
}
