"use client";

import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { formatTimestamp } from "@/components/video/types";

/* ─── Types ────────────────────────────────────────────────────────────────── */

type Props = {
  visible: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  frameStep: number;
  thumbnailUrl?: string;
  onPlayPause: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSeek: (time: number) => void;
};

/* ─── Component ────────────────────────────────────────────────────────────── */

export function MiniPlayer({
  visible,
  isPlaying,
  currentTime,
  duration,
  frameStep,
  thumbnailUrl,
  onPlayPause,
  onStepForward,
  onStepBackward,
  onSeek,
}: Props) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`fixed inset-x-0 z-10 lg:hidden transition-all duration-200 ease-out ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-full pointer-events-none"
      }`}
      style={{ top: "calc(3.5rem + env(safe-area-inset-top, 0px))" }}
      role="region"
      aria-label="Video mini player"
      aria-hidden={!visible}
    >
      <div className="bg-[var(--card-bg)] border-b border-[var(--card-border)] shadow-lg backdrop-blur-md">
        {/* Controls row — 44px */}
        <div className="flex items-center gap-2 px-3 h-11">
          {/* Thumbnail */}
          {thumbnailUrl && (
            <div className="w-8 h-8 rounded overflow-hidden shrink-0 bg-surface-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Transport controls */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onStepBackward}
              className="p-1.5 rounded text-muted hover:text-[var(--foreground)] active:scale-95 transition-all"
              aria-label="Previous frame"
              tabIndex={visible ? 0 : -1}
            >
              <SkipBack size={14} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onPlayPause}
              className="p-1.5 rounded-full bg-primary-500 text-white hover:bg-primary-600 active:scale-95 transition-all"
              aria-label={isPlaying ? "Pause" : "Play"}
              tabIndex={visible ? 0 : -1}
            >
              {isPlaying ? (
                <Pause size={14} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Play size={14} strokeWidth={2} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={onStepForward}
              className="p-1.5 rounded text-muted hover:text-[var(--foreground)] active:scale-95 transition-all"
              aria-label="Next frame"
              tabIndex={visible ? 0 : -1}
            >
              <SkipForward size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          {/* Timestamp — pushed right */}
          <span className="text-[10px] font-mono tabular-nums text-muted whitespace-nowrap ml-auto">
            {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
          </span>
        </div>

        {/* Scrub bar — 4px at bottom edge */}
        <div className="relative h-1 bg-surface-200 dark:bg-surface-800">
          {/* Visual fill */}
          <div
            className="absolute inset-y-0 left-0 bg-primary-500 transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
          {/* Invisible range input for interaction — larger touch target */}
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={frameStep}
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="absolute -top-2 left-0 w-full h-5 opacity-0 cursor-pointer"
            aria-label="Scrub video position"
            tabIndex={visible ? 0 : -1}
          />
        </div>
      </div>
    </div>
  );
}
