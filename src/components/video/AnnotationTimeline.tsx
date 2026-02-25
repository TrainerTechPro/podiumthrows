"use client";

import { useMemo } from "react";
import { type Annotation, formatTimestamp } from "./types";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  annotations: Annotation[];
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  className?: string;
};

/* ─── Type-to-color map ───────────────────────────────────────────────────── */

const TYPE_COLORS: Record<string, string> = {
  line: "#3b82f6",
  arrow: "#f97316",
  circle: "#22c55e",
  angle: "#a855f7",
  freehand: "#ef4444",
  text: "#eab308",
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function AnnotationTimeline({
  annotations,
  duration,
  currentTime,
  onSeek,
  className,
}: Props) {
  const sortedAnnotations = useMemo(
    () => [...annotations].sort((a, b) => a.timestamp - b.timestamp),
    [annotations]
  );

  if (duration <= 0) return null;

  const playheadPosition = (currentTime / duration) * 100;

  return (
    <div className={`relative ${className ?? ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
          Annotations Timeline
        </span>
        <span className="text-[10px] text-surface-400 tabular-nums">
          {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Timeline bar */}
      <div
        className="relative h-8 bg-surface-100 dark:bg-surface-800 rounded-lg cursor-pointer overflow-hidden"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const frac = Math.max(
            0,
            Math.min(1, (e.clientX - rect.left) / rect.width)
          );
          onSeek(frac * duration);
        }}
      >
        {/* Annotation markers */}
        {sortedAnnotations.map((ann) => {
          const left = (ann.timestamp / duration) * 100;
          const width = Math.max(
            0.5,
            ((ann.duration ?? 3) / duration) * 100
          );
          const color = TYPE_COLORS[ann.type] ?? "#888";

          return (
            <div
              key={ann.id}
              className="absolute top-1 bottom-1 rounded-sm opacity-60 hover:opacity-100 transition-opacity group/marker"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                minWidth: "4px",
                backgroundColor: color,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(ann.timestamp);
              }}
              title={`${formatTimestamp(ann.timestamp)} — ${ann.type}${ann.text ? `: ${ann.text}` : ""}`}
            >
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/marker:block pointer-events-none z-20">
                <div className="bg-surface-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow-lg">
                  {formatTimestamp(ann.timestamp)} · {ann.type}
                  {ann.text ? ` · "${ann.text}"` : ""}
                </div>
              </div>
            </div>
          );
        })}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.5)] z-10 pointer-events-none"
          style={{ left: `${playheadPosition}%` }}
        />
      </div>

      {/* Time labels */}
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-surface-400 tabular-nums font-mono">
          {formatTimestamp(0)}
        </span>
        <span className="text-[9px] text-surface-400 tabular-nums font-mono">
          {formatTimestamp(duration)}
        </span>
      </div>
    </div>
  );
}
