"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
  type ReactNode,
} from "react";
import { useZoomPan, type ZoomPanState } from "./useZoomPan";
import { ZoomableVideoContainer } from "./ZoomableVideoContainer";
import { AnnotationCanvas } from "./AnnotationCanvas";
import { JogWheel } from "./JogWheel";
import { CanvasFrameRenderer } from "./CanvasFrameRenderer";
import { useFrameExtractor } from "./useFrameExtractor";
import {
  snapToFrame,
  frameIndexToTime,
  timeToFrameIndex,
  ANALYSIS_FPS,
  FRAME_STEP,
  PLAYBACK_SPEEDS,
  formatTimestamp,
  type Annotation,
  type AnnotationTool,
} from "./types";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type VideoSource = {
  src: string;
  poster?: string;
  title?: string;
};

type Props = {
  videoA: VideoSource;
  videoB?: VideoSource;
  mode: "single" | "split" | "ghost";
  annotations: Annotation[];
  isEditing: boolean;
  activeTool: AnnotationTool;
  activeColor: string;
  activeStrokeWidth: number;
  onAnnotationAdd: (ann: Annotation) => void;
  onTimeUpdate?: (time: number) => void;
  onDurationReady?: (duration: number) => void;
  ghostOpacity?: number;
  onGhostOpacityChange?: (v: number) => void;
  className?: string;
};

/* ─── Imperative Handle ───────────────────────────────────────────────────── */

export type VideoAnalysisWorkspaceHandle = {
  seekTo: (time: number) => void;
};

/* ─── Constants ───────────────────────────────────────────────────────────── */

const SYNC_DRIFT_THRESHOLD = FRAME_STEP * 1.5; // ~25ms at 60fps
const SPEED_OPTIONS = PLAYBACK_SPEEDS;

/* ─── Component ───────────────────────────────────────────────────────────── */

export const VideoAnalysisWorkspace = forwardRef<
  VideoAnalysisWorkspaceHandle,
  Props
>(function VideoAnalysisWorkspace(
  {
    videoA,
    videoB,
    mode,
    annotations,
    isEditing,
    activeTool,
    activeColor,
    activeStrokeWidth,
    onAnnotationAdd,
    onTimeUpdate,
    onDurationReady,
    ghostOpacity = 50,
    onGhostOpacityChange,
    className,
  },
  ref
) {
  /* ── Raw video element refs (zero-jitter direct access) ────────────── */

  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);

  /* ── State ──────────────────────────────────────────────────────────── */

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Frame-perfect mode
  const [framePerfectMode, setFramePerfectMode] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);

  const frameExtractor = useFrameExtractor({
    maxDuration: 10,
    resolution: "half",
    fps: ANALYSIS_FPS,
  });

  /** Frame-perfect mode is active when frames are extracted and mode is on */
  const framePerfectActive =
    framePerfectMode &&
    frameExtractor.frames.length > 0 &&
    !frameExtractor.isExtracting;

  // Sync locks
  const [syncLock, setSyncLock] = useState(true);
  const [spatialLock, setSpatialLock] = useState(true);

  // Spatial sync state (leader → follower)
  const [leaderZoomState, setLeaderZoomState] = useState<ZoomPanState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  // rAF refs
  const syncRafRef = useRef(0);
  const timeUpdateRafRef = useRef(0);

  /* ── Zoom/Pan hooks ────────────────────────────────────────────────── */

  const zoomPanA = useZoomPan({
    enabled: true,
    isDrawingActive: isEditing && activeTool !== "select",
    onTransformChange: spatialLock ? setLeaderZoomState : undefined,
  });

  const zoomPanB = useZoomPan({
    enabled: mode === "split",
    linkedState: spatialLock ? leaderZoomState : undefined,
  });

  /* ── Video A metadata ready ────────────────────────────────────────── */

  const handleLoadedMetadata = useCallback(() => {
    const v = videoARef.current;
    if (!v) return;
    const dur = v.duration;
    if (Number.isFinite(dur)) {
      setDuration(dur);
      onDurationReady?.(dur);
    }
  }, [onDurationReady]);

  /* ── Time update loop (rAF for smooth updates) ─────────────────────── */

  useEffect(() => {
    const v = videoARef.current;
    if (!v) return;

    function tick() {
      if (v && !v.paused) {
        const t = v.currentTime;
        setCurrentTime(t);
        onTimeUpdate?.(t);
      }
      timeUpdateRafRef.current = requestAnimationFrame(tick);
    }

    timeUpdateRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(timeUpdateRafRef.current);
  }, [onTimeUpdate]);

  /* ── Continuous playback sync (rAF drift correction) ───────────────── */

  useEffect(() => {
    if (mode === "single" || !syncLock) return;

    const vA = videoARef.current;
    const vB = videoBRef.current;
    if (!vA || !vB) return;

    function correctDrift() {
      if (vA && vB && !vA.paused && syncLock) {
        const drift = Math.abs(vA.currentTime - vB.currentTime);
        if (drift > SYNC_DRIFT_THRESHOLD) {
          vB.currentTime = vA.currentTime;
        }
      }
      syncRafRef.current = requestAnimationFrame(correctDrift);
    }

    syncRafRef.current = requestAnimationFrame(correctDrift);
    return () => cancelAnimationFrame(syncRafRef.current);
  }, [mode, syncLock]);

  /* ── Playback speed sync ───────────────────────────────────────────── */

  useEffect(() => {
    if (videoARef.current) videoARef.current.playbackRate = playbackSpeed;
    if (videoBRef.current) videoBRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  /* ── Play / Pause ──────────────────────────────────────────────────── */

  const togglePlay = useCallback(() => {
    const vA = videoARef.current;
    if (!vA) return;

    if (vA.paused) {
      vA.play();
      if (syncLock && videoBRef.current) videoBRef.current.play();
      setIsPlaying(true);
    } else {
      vA.pause();
      if (videoBRef.current) videoBRef.current.pause();
      setIsPlaying(false);
    }
  }, [syncLock]);

  /* ── Seek (from JogWheel end or scrub bar) ─────────────────────────── */

  const handleSeek = useCallback(
    (time: number) => {
      const snapped = snapToFrame(time, ANALYSIS_FPS);
      const clamped = Math.max(0, Math.min(duration, snapped));

      if (videoARef.current) videoARef.current.currentTime = clamped;
      if (syncLock && videoBRef.current) videoBRef.current.currentTime = clamped;

      setCurrentTime(clamped);
      onTimeUpdate?.(clamped);
    },
    [duration, syncLock, onTimeUpdate]
  );

  /* ── Imperative handle (for external seekTo from AnnotationTimeline, etc.) */

  useImperativeHandle(ref, () => ({
    seekTo: handleSeek,
  }), [handleSeek]);

  /** Handle frame index changes from JogWheel in frame-perfect mode */
  const handleFrameChange = useCallback(
    (index: number) => {
      setCurrentFrameIndex(index);
      // Keep currentTime in sync for annotations, timestamps, etc.
      const time = frameIndexToTime(index, ANALYSIS_FPS);
      setCurrentTime(time);
      onTimeUpdate?.(time);
    },
    [onTimeUpdate]
  );

  /* ── Frame step ────────────────────────────────────────────────────── */

  const frameStep = useCallback(
    (dir: 1 | -1) => {
      // Frame-perfect mode: step through frame array directly
      if (framePerfectActive) {
        const next = Math.max(
          0,
          Math.min(frameExtractor.totalFrames - 1, currentFrameIndex + dir)
        );
        handleFrameChange(next);
        return;
      }

      const vA = videoARef.current;
      if (!vA) return;

      // Pause during frame stepping
      vA.pause();
      if (videoBRef.current) videoBRef.current.pause();
      setIsPlaying(false);

      const next = snapToFrame(vA.currentTime + dir * FRAME_STEP, ANALYSIS_FPS);
      const clamped = Math.max(0, Math.min(duration, next));

      vA.currentTime = clamped;
      if (syncLock && videoBRef.current) videoBRef.current.currentTime = clamped;

      setCurrentTime(clamped);
      onTimeUpdate?.(clamped);
    },
    [
      duration,
      syncLock,
      onTimeUpdate,
      framePerfectActive,
      frameExtractor.totalFrames,
      currentFrameIndex,
      handleFrameChange,
    ]
  );

  /* ── Re-sync ───────────────────────────────────────────────────────── */

  const reSync = useCallback(() => {
    const vA = videoARef.current;
    const vB = videoBRef.current;
    if (vA && vB) {
      vB.currentTime = vA.currentTime;
      if (!vA.paused) vB.play();
    }
  }, []);

  /* ── Frame-Perfect Mode toggle ─────────────────────────────────────── */

  const toggleFramePerfect = useCallback(() => {
    if (framePerfectMode) {
      // Turning OFF — sync video to frame position and clean up
      const time = frameIndexToTime(currentFrameIndex, ANALYSIS_FPS);
      if (videoARef.current) videoARef.current.currentTime = time;
      setCurrentTime(time);
      onTimeUpdate?.(time);
      setFramePerfectMode(false);
    } else {
      // Turning ON — start extraction
      if (frameExtractor.frames.length === 0 && !frameExtractor.isExtracting) {
        frameExtractor.extract(videoA.src);
      }
      // Pause video during frame-perfect mode
      if (videoARef.current && !videoARef.current.paused) {
        videoARef.current.pause();
        if (videoBRef.current) videoBRef.current.pause();
        setIsPlaying(false);
      }
      // Set initial frame index from current time
      setCurrentFrameIndex(timeToFrameIndex(currentTime, ANALYSIS_FPS));
      setFramePerfectMode(true);
    }
  }, [
    framePerfectMode,
    currentFrameIndex,
    currentTime,
    frameExtractor,
    videoA.src,
    onTimeUpdate,
  ]);

  /* ── Keyboard shortcuts ────────────────────────────────────────────── */

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case ",":
          e.preventDefault();
          frameStep(-1);
          break;
        case ".":
          e.preventDefault();
          frameStep(1);
          break;
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [togglePlay, frameStep]);

  /* ── Close speed menu on outside click ─────────────────────────────── */

  useEffect(() => {
    if (!showSpeedMenu) return;
    const h = () => setShowSpeedMenu(false);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [showSpeedMenu]);

  /* ── Clean up frame extraction on unmount or video source change ───── */

  useEffect(() => {
    return () => {
      frameExtractor.cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoA.src]);

  /* ── Video event handlers ──────────────────────────────────────────── */

  const handleVideoAPlay = useCallback(() => setIsPlaying(true), []);
  const handleVideoAPause = useCallback(() => setIsPlaying(false), []);

  /* ── Annotation canvas (reused across modes) ───────────────────────── */

  const annotationOverlay = (
    <AnnotationCanvas
      annotations={annotations}
      currentTime={currentTime}
      isEditing={isEditing}
      activeTool={activeTool}
      activeColor={activeColor}
      activeStrokeWidth={activeStrokeWidth}
      onAnnotationAdd={onAnnotationAdd}
    />
  );

  /* ── Computed ───────────────────────────────────────────────────────── */

  const progress = framePerfectActive
    ? frameExtractor.totalFrames > 1
      ? (currentFrameIndex / (frameExtractor.totalFrames - 1)) * 100
      : 0
    : duration > 0
      ? (currentTime / duration) * 100
      : 0;
  const hasVideoB = !!videoB && mode !== "single";
  const modeLabel = mode === "ghost" ? "Ghost" : mode === "split" ? "Split" : "Single";

  /* ── Render: Video Area ────────────────────────────────────────────── */

  let videoArea: ReactNode;

  if (mode === "single") {
    /* ── SINGLE MODE ── */
    videoArea = (
      <ZoomableVideoContainer zoomPan={zoomPanA} className="aspect-video bg-black rounded-xl overflow-hidden">
        <div className="relative w-full h-full">
          {/* Hidden video element — kept mounted for metadata, audio, and fallback */}
          <video
            ref={videoARef}
            src={videoA.src}
            poster={videoA.poster}
            className="w-full h-full object-contain"
            style={framePerfectActive ? { display: "none" } : undefined}
            playsInline
            preload="metadata"
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={handleVideoAPlay}
            onPause={handleVideoAPause}
            onClick={togglePlay}
          />

          {/* Frame-perfect canvas renderer */}
          {framePerfectActive && (
            <CanvasFrameRenderer
              frames={frameExtractor.frames}
              currentFrame={currentFrameIndex}
              className="w-full h-full object-contain"
            />
          )}

          {/* Extraction progress overlay */}
          {framePerfectMode && frameExtractor.isExtracting && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 z-10">
              <div className="text-xs font-medium text-primary-400 uppercase tracking-wider">
                Extracting Frames…
              </div>
              <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-200"
                  style={{ width: `${frameExtractor.progress}%` }}
                />
              </div>
              <span className="text-[10px] text-surface-400 font-mono">
                {frameExtractor.progress}%
              </span>
              <button
                onClick={() => {
                  frameExtractor.cancel();
                  setFramePerfectMode(false);
                }}
                className="mt-1 text-[10px] text-surface-500 hover:text-white transition-colors underline"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Extraction error overlay */}
          {framePerfectMode && frameExtractor.error && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 z-10">
              <span className="text-xs text-red-400">
                Frame extraction failed: {frameExtractor.error}
              </span>
              <button
                onClick={() => setFramePerfectMode(false)}
                className="text-[10px] text-surface-400 hover:text-white transition-colors underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Annotation canvas overlay */}
          <div
            className="absolute inset-0"
            style={{ pointerEvents: isEditing ? "auto" : "none" }}
          >
            {annotationOverlay}
          </div>
        </div>
      </ZoomableVideoContainer>
    );
  } else if (mode === "split") {
    /* ── SPLIT MODE ── */
    videoArea = (
      <div className="grid grid-cols-2 gap-2">
        {/* Video A — leader */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 px-1">
            <span className="w-5 h-5 rounded bg-primary-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              A
            </span>
            <span className="text-xs font-medium text-[var(--foreground)] truncate">
              {videoA.title ?? "Primary"}
            </span>
          </div>
          <ZoomableVideoContainer zoomPan={zoomPanA} className="aspect-video bg-black rounded-xl overflow-hidden">
            <div className="relative w-full h-full">
              <video
                ref={videoARef}
                src={videoA.src}
                poster={videoA.poster}
                className="w-full h-full object-contain"
                playsInline
                preload="metadata"
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={handleVideoAPlay}
                onPause={handleVideoAPause}
                onClick={togglePlay}
              />
              <div
                className="absolute inset-0"
                style={{ pointerEvents: isEditing ? "auto" : "none" }}
              >
                {annotationOverlay}
              </div>
            </div>
          </ZoomableVideoContainer>
        </div>

        {/* Video B — follower */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 px-1">
            <span className="w-5 h-5 rounded bg-surface-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              B
            </span>
            <span className="text-xs font-medium text-surface-500 truncate">
              {videoB?.title ?? "Comparison"}
            </span>
          </div>
          <ZoomableVideoContainer zoomPan={zoomPanB} className="aspect-video bg-black rounded-xl overflow-hidden">
            <div className="relative w-full h-full">
              {videoB ? (
                <video
                  ref={videoBRef}
                  src={videoB.src}
                  poster={videoB.poster}
                  className="w-full h-full object-contain"
                  playsInline
                  preload="metadata"
                  muted
                  onClick={togglePlay}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-surface-500 text-sm">
                  No comparison video selected
                </div>
              )}
            </div>
          </ZoomableVideoContainer>
        </div>
      </div>
    );
  } else {
    /* ── GHOST MODE ── */
    videoArea = (
      <ZoomableVideoContainer zoomPan={zoomPanA} className="aspect-video bg-black rounded-xl overflow-hidden">
        <div className="relative w-full h-full">
          {/* Primary video */}
          <video
            ref={videoARef}
            src={videoA.src}
            poster={videoA.poster}
            className="w-full h-full object-contain"
            playsInline
            preload="metadata"
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={handleVideoAPlay}
            onPause={handleVideoAPause}
            onClick={togglePlay}
          />

          {/* Ghost overlay */}
          {videoB && (
            <video
              ref={videoBRef}
              src={videoB.src}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{ opacity: ghostOpacity / 100 }}
              playsInline
              preload="metadata"
              muted
            />
          )}

          {/* Annotation canvas */}
          <div
            className="absolute inset-0"
            style={{ pointerEvents: isEditing ? "auto" : "none" }}
          >
            {annotationOverlay}
          </div>

          {/* Ghost labels */}
          {videoB && (
            <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-none z-10">
              <span className="text-[10px] bg-primary-500/80 text-white px-2 py-0.5 rounded font-medium">
                A — {videoA.title ?? "Primary"}
              </span>
              <span
                className="text-[10px] bg-surface-600/80 text-white px-2 py-0.5 rounded font-medium"
                style={{ opacity: ghostOpacity / 100 + 0.4 }}
              >
                B — {videoB.title ?? "Ghost"}
              </span>
            </div>
          )}
        </div>
      </ZoomableVideoContainer>
    );
  }

  /* ── Render: Full Component ────────────────────────────────────────── */

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {/* Video area */}
      {videoArea}

      {/* ── Control Bar ──────────────────────────────────────────────── */}
      <div className="bg-surface-900 dark:bg-surface-950 rounded-xl px-4 py-3 space-y-2.5">
        {/* Top row: mode badge + ghost opacity + sync toggles */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-400">
              {modeLabel} Analysis
            </span>
            {hasVideoB && syncLock && (
              <span className="text-[10px] text-surface-500">
                · Synchronized playback
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
            {mode === "ghost" && onGhostOpacityChange && (
              <label className="flex items-center gap-1.5 text-[10px] text-surface-400">
                Ghost
                <input
                  type="range"
                  min={10}
                  max={90}
                  step={5}
                  value={ghostOpacity}
                  onChange={(e) => onGhostOpacityChange(parseInt(e.target.value))}
                  className="w-16 h-1 accent-primary-500 cursor-pointer"
                />
                {ghostOpacity}%
              </label>
            )}

            {/* Sync lock toggle (split + ghost) */}
            {hasVideoB && (
              <button
                onClick={() => setSyncLock((v) => !v)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  syncLock
                    ? "bg-green-500/20 text-green-400"
                    : "bg-surface-800 text-surface-500 hover:text-surface-300"
                }`}
                title={syncLock ? "Temporal sync ON" : "Temporal sync OFF"}
              >
                <SyncIcon />
                Sync
              </button>
            )}

            {/* Spatial lock toggle (split only) */}
            {mode === "split" && videoB && (
              <button
                onClick={() => setSpatialLock((v) => !v)}
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
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="relative w-full opacity-0 h-4 cursor-pointer"
              aria-label="Scrub video"
            />
          )}
        </div>

        {/* Transport controls row */}
        <div className="flex items-center gap-2 text-white">
          {/* Frame back */}
          <button
            onClick={() => frameStep(-1)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title="Previous frame (,)"
          >
            <FrameBackIcon />
          </button>

          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-primary-500 hover:bg-primary-400 flex items-center justify-center transition-colors shrink-0"
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          {/* Frame forward */}
          <button
            onClick={() => frameStep(1)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title="Next frame (.)"
          >
            <FrameFwdIcon />
          </button>

          {/* Time display */}
          <span className="font-mono text-xs tabular-nums text-surface-300 min-w-[110px]">
            {formatTimestamp(currentTime)}
            <span className="text-surface-600"> / </span>
            {formatTimestamp(duration)}
          </span>

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
                setShowSpeedMenu((v) => !v);
              }}
              className="px-2 py-0.5 hover:bg-white/10 rounded transition-colors text-xs font-mono text-surface-300"
              title="Playback speed"
            >
              {playbackSpeed}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-1 bg-surface-800 border border-surface-600 rounded-lg py-1 shadow-xl z-20">
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlaybackSpeed(s);
                      setShowSpeedMenu(false);
                    }}
                    className={`block w-full text-left px-3 py-1 text-xs hover:bg-white/10 ${
                      playbackSpeed === s ? "text-primary-400" : "text-white"
                    }`}
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
              title="Re-sync video B to current time"
            >
              <ReSyncIcon />
            </button>
          )}
        </div>

        {/* JogWheel — zero-jitter with direct video ref or frame-perfect mode */}
        <JogWheel
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
          sensitivity={0.02}
          fps={ANALYSIS_FPS}
          videoRef={framePerfectActive ? undefined : videoARef}
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
    </div>
  );
});

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
