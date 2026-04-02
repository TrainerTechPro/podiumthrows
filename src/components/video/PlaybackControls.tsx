"use client";

import { useMemo } from "react";
import { useVideoWorkspace } from "./useVideoWorkspace";
import { JogWheel } from "./JogWheel";
import { formatTimestamp, ANALYSIS_FPS, FRAME_STEP } from "./types";

/* ─── Component ───────────────────────────────────────────────────────────── */

/**
 * Fully self-contained playback controls bar.
 * Reads ALL state from `useVideoWorkspace()` context — no props needed.
 *
 * Renders: mode badge, sync/link toggles, scrub bar, transport buttons,
 * speed selector, timestamp, and JogWheel.
 */
export function PlaybackControls() {
  const {
    // Playback state
    currentTime,
    duration,
    isPlaying,
    playbackSpeed,
    mode,
    ghostOpacity,
    progress,

    // Frame-perfect
    framePerfectMode,
    framePerfectActive,
    currentFrameIndex,
    frameExtractor,
    toggleFramePerfect,
    handleFrameChange,

    // Sync & linking
    syncLock,
    syncOffset,
    spatialLock,
    linked,
    activePanel,
    hasVideoB,
    jogWheelTargetsB,
    bCurrentTime,
    bDuration,

    // Actions
    togglePlay,
    setSpeed,
    stepForward,
    stepBackward,
    seekTo,
    seekB,
    reSync,
    toggleSyncLock,
    toggleLinked,
    toggleSpatialLock,
    setGhostOpacity,

    // Speed menu
    showSpeedMenu,
    setShowSpeedMenu,
    speedOptions,

    // Refs
    videoARef,
    videoBRef,
  } = useVideoWorkspace();

  /* ── Memoized timestamp strings ─────────────────────────────────────── */

  const formattedCurrentTime = useMemo(
    () => formatTimestamp(currentTime),
    [currentTime]
  );
  const formattedDuration = useMemo(
    () => formatTimestamp(duration),
    [duration]
  );
  const formattedBCurrentTime = useMemo(
    () => formatTimestamp(bCurrentTime),
    [bCurrentTime]
  );

  const modeLabel =
    mode === "ghost" ? "Ghost" : mode === "split" ? "Split" : "Single";

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="bg-surface-900 dark:bg-surface-950 rounded-xl px-4 py-3 space-y-2.5">
      {/* Top row: mode badge + status + sync/link toggles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-400">
            {modeLabel} Analysis
          </span>
          {/* Offset badge */}
          {hasVideoB && syncLock && (
            <span className="text-[10px] text-surface-500 font-mono">
              · Synced
              {Math.abs(syncOffset) > 0.001
                ? ` \u0394${syncOffset > 0 ? "+" : ""}${syncOffset.toFixed(2)}s`
                : ""}
            </span>
          )}
          {/* Active panel indicator when unlinked */}
          {hasVideoB && !linked && (
            <span className="text-[10px] text-amber-500/80">
              · Wheel → {activePanel === "B" ? "B" : "A"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Frame-Perfect toggle (single mode only) */}
          {mode === "single" && (
            <button
              onClick={toggleFramePerfect}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                framePerfectMode
                  ? "bg-primary-500/20 text-primary-400"
                  : "bg-surface-800 text-surface-500 hover:text-surface-300"
              }`}
              title={
                framePerfectMode
                  ? "Switch back to normal video playback"
                  : "Enable zero-jitter frame-by-frame scrubbing"
              }
              disabled={frameExtractor.isExtracting}
            >
              <FramePerfectIcon />
              {frameExtractor.isExtracting
                ? `${frameExtractor.progress}%`
                : framePerfectMode
                  ? "Frame-Perfect ON"
                  : "Frame-Perfect"}
            </button>
          )}

          {/* Ghost opacity */}
          {mode === "ghost" && (
            <label className="flex items-center gap-1.5 text-[10px] text-surface-400">
              Ghost
              <input
                type="range"
                min={10}
                max={90}
                step={5}
                value={ghostOpacity}
                onChange={(e) => setGhostOpacity(parseInt(e.target.value))}
                className="w-16 h-1 accent-primary-500 cursor-pointer"
              />
              {ghostOpacity}%
            </label>
          )}

          {/* Sync lock toggle (split + ghost) */}
          {hasVideoB && (
            <button
              onClick={toggleSyncLock}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                syncLock
                  ? "bg-green-500/20 text-green-400"
                  : "bg-surface-800 text-surface-500 hover:text-surface-300"
              }`}
              title={
                syncLock
                  ? "Temporal sync ON — click to unlock and reposition B"
                  : "Temporal sync OFF — move B to target frame, then click to lock offset"
              }
            >
              <SyncIcon />
              Sync
            </button>
          )}

          {/* Link / Unlink toggle (split + ghost) */}
          {hasVideoB && (
            <button
              onClick={toggleLinked}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                linked
                  ? "bg-green-500/20 text-green-400"
                  : "bg-amber-500/20 text-amber-400"
              }`}
              title={
                linked
                  ? "JogWheel drives both videos — click to scrub independently"
                  : "JogWheel scrubs active panel only — click to re-link"
              }
            >
              {linked ? <LinkIcon /> : <UnlinkIcon />}
              {linked ? "Linked" : "Unlinked"}
            </button>
          )}

          {/* Spatial lock toggle (split only) */}
          {mode === "split" && hasVideoB && (
            <button
              onClick={toggleSpatialLock}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                spatialLock
                  ? "bg-green-500/20 text-green-400"
                  : "bg-surface-800 text-surface-500 hover:text-surface-300"
              }`}
              title={spatialLock ? "Spatial sync ON" : "Spatial sync OFF"}
            >
              <SpatialIcon />
              Spatial
            </button>
          )}
        </div>
      </div>

      {/* Scrub bar */}
      <div className="relative group/scrub">
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-white/10 rounded-full pointer-events-none" />
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-1.5 bg-primary-500 rounded-full pointer-events-none"
          style={{ width: `${progress}%` }}
        />
        {framePerfectActive ? (
          <input
            type="range"
            min={0}
            max={frameExtractor.totalFrames - 1 || 1}
            step={1}
            value={currentFrameIndex}
            onChange={(e) => handleFrameChange(parseInt(e.target.value))}
            className="relative w-full opacity-0 h-4 cursor-pointer"
            aria-label="Scrub frames"
          />
        ) : (
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={FRAME_STEP}
            value={currentTime}
            onChange={(e) => seekTo(parseFloat(e.target.value))}
            className="relative w-full opacity-0 h-4 cursor-pointer"
            aria-label="Scrub video"
          />
        )}
      </div>

      {/* Transport controls row */}
      <div className="flex items-center gap-2 text-white">
        {/* Frame back */}
        <button
          onClick={stepBackward}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          title="Previous frame (,)"
          aria-label="Previous frame"
        >
          <FrameBackIcon />
        </button>

        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full bg-primary-500 hover:bg-primary-400 flex items-center justify-center transition-colors shrink-0"
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        {/* Frame forward */}
        <button
          onClick={stepForward}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          title="Next frame (.)"
          aria-label="Next frame"
        >
          <FrameFwdIcon />
        </button>

        {/* Time display */}
        <span className="font-mono text-xs tabular-nums text-surface-300 min-w-[110px]">
          {formattedCurrentTime}
          <span className="text-surface-600"> / </span>
          {formattedDuration}
        </span>

        {/* Video B time readout when unlinked and B is the active panel */}
        {jogWheelTargetsB && (
          <span className="font-mono text-[10px] tabular-nums text-amber-400/80">
            B: {formattedBCurrentTime}
          </span>
        )}

        {/* Frame counter (frame-perfect mode) */}
        {framePerfectActive && (
          <span className="font-mono text-[10px] tabular-nums text-primary-400/80">
            F{currentFrameIndex + 1}/{frameExtractor.totalFrames}
          </span>
        )}

        <div className="flex-1" />

        {/* Speed selector */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSpeedMenu(!showSpeedMenu);
            }}
            className="px-2 py-0.5 hover:bg-white/10 rounded transition-colors text-xs font-mono text-surface-300"
            title="Playback speed"
            aria-label={`Playback speed: ${playbackSpeed}x`}
            aria-haspopup="menu"
            aria-expanded={showSpeedMenu}
          >
            {playbackSpeed}x
          </button>
          {showSpeedMenu && (
            <div
              role="menu"
              aria-label="Playback speed options"
              className="absolute bottom-full right-0 mb-1 bg-surface-800 border border-surface-600 rounded-lg py-1 shadow-xl z-20"
            >
              {speedOptions.map((s) => (
                <button
                  key={s}
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSpeed(s);
                  }}
                  className={`block w-full text-left px-3 py-1 text-xs hover:bg-white/10 ${
                    playbackSpeed === s ? "text-primary-400" : "text-white"
                  }`}
                  aria-current={playbackSpeed === s ? "true" : undefined}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Re-sync button */}
        {hasVideoB && (
          <button
            onClick={reSync}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-surface-400 hover:text-white"
            title={
              Math.abs(syncOffset) > 0.001
                ? `Re-sync B (\u0394${syncOffset > 0 ? "+" : ""}${syncOffset.toFixed(2)}s)`
                : "Re-sync video B to current time"
            }
          >
            <ReSyncIcon />
          </button>
        )}
      </div>

      {/* JogWheel */}
      <JogWheel
        currentTime={jogWheelTargetsB ? bCurrentTime : currentTime}
        duration={jogWheelTargetsB ? bDuration || duration : duration}
        onSeek={jogWheelTargetsB ? seekB : seekTo}
        sensitivity={0.02}
        fps={ANALYSIS_FPS}
        videoRef={
          framePerfectActive
            ? undefined
            : jogWheelTargetsB
              ? videoBRef
              : videoARef
        }
        frameMode={
          framePerfectActive
            ? {
                totalFrames: frameExtractor.totalFrames,
                currentFrame: currentFrameIndex,
                onFrameChange: handleFrameChange,
              }
            : undefined
        }
        className="mt-1"
      />
    </div>
  );
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function FrameBackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="11 19 2 12 11 5" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function FrameFwdIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13 5 22 12 13 19" />
      <line x1="22" y1="12" x2="2" y2="12" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function SpatialIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
    </svg>
  );
}

function ReSyncIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <polyline points="23 20 23 14 17 14" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  );
}

function FramePerfectIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <line x1="8" y1="2" x2="8" y2="22" />
      <line x1="16" y1="2" x2="16" y2="22" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 7h3a5 5 0 0 1 0 10h-3" />
      <path d="M9 17H6A5 5 0 0 1 6 7h3" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function UnlinkIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 7h3a5 5 0 0 1 0 10h-3" />
      <path d="M9 17H6A5 5 0 0 1 6 7h3" />
    </svg>
  );
}
