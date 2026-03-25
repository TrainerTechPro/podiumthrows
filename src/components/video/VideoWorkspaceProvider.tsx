"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useZoomPan, type ZoomPanState } from "./useZoomPan";
import { useFrameExtractor } from "./useFrameExtractor";
import {
  VideoWorkspaceContext,
  type VideoWorkspaceState,
  type VideoSource,
} from "./useVideoWorkspace";
import {
  snapToFrame,
  frameIndexToTime,
  timeToFrameIndex,
  ANALYSIS_FPS,
  FRAME_STEP,
  PLAYBACK_SPEEDS,
} from "./types";

/* ─── Constants ───────────────────────────────────────────────────────────── */

const SYNC_DRIFT_THRESHOLD = FRAME_STEP * 1.5; // ~25ms at 60fps
/** Minimum time advance before triggering a React re-render — suppresses sub-frame noise */
const MIN_TIME_DELTA = FRAME_STEP * 0.5;
const SPEED_OPTIONS = PLAYBACK_SPEEDS;

/* ─── Provider Props ──────────────────────────────────────────────────────── */

export interface VideoWorkspaceProviderProps {
  videoA: VideoSource;
  videoB?: VideoSource;
  mode: "single" | "split" | "ghost";
  /** Callback fired when video A time updates */
  onTimeUpdate?: (time: number) => void;
  /** Callback fired when video A metadata provides its duration */
  onDurationReady?: (duration: number) => void;
  /** Ghost overlay opacity 0-100 (default 50) */
  ghostOpacity?: number;
  /** Callback when ghost opacity changes */
  onGhostOpacityChange?: (v: number) => void;
  /** Whether annotation drawing is active (affects zoom/pan gesture routing) */
  isDrawingActive?: boolean;
  children: ReactNode;
}

/* ─── Provider ────────────────────────────────────────────────────────────── */

export function VideoWorkspaceProvider({
  videoA,
  videoB,
  mode,
  onTimeUpdate,
  onDurationReady,
  ghostOpacity: ghostOpacityProp = 50,
  onGhostOpacityChange,
  isDrawingActive = false,
  children,
}: VideoWorkspaceProviderProps) {
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

  // Time-offset sync: A.currentTime - B.currentTime captured when sync is engaged.
  const [syncOffset, setSyncOffset] = useState(0);
  const syncOffsetRef = useRef(0);

  // Linked vs unlinked JogWheel.
  const [linked, setLinked] = useState(true);
  const [activePanel, setActivePanel] = useState<"A" | "B">("A");

  // Video B timing
  const [bCurrentTime, setBCurrentTime] = useState(0);
  const [bDuration, setBDuration] = useState(0);

  // Spatial sync state (leader -> follower)
  const [leaderZoomState, setLeaderZoomState] = useState<ZoomPanState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  // Master render loop ref
  const masterLoopRef = useRef(0);
  const lastReportedTimeRef = useRef(-1);
  const syncLockRef = useRef(syncLock);
  const modeRef = useRef(mode);

  /* ── Keep mutable refs current (prevents stale closures in rAF loop) ── */

  useEffect(() => {
    syncOffsetRef.current = syncOffset;
  }, [syncOffset]);

  useEffect(() => {
    syncLockRef.current = syncLock;
  }, [syncLock]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  /* ── Zoom/Pan hooks ────────────────────────────────────────────────── */

  const zoomPanA = useZoomPan({
    enabled: true,
    isDrawingActive,
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

  /* ── Video B metadata + time updates ───────────────────────────────── */

  const handleLoadedMetadataB = useCallback(() => {
    const vB = videoBRef.current;
    if (vB && isFinite(vB.duration)) setBDuration(vB.duration);
  }, []);

  const handleVideoBTimeUpdate = useCallback(() => {
    if (videoBRef.current) setBCurrentTime(videoBRef.current.currentTime);
  }, []);

  /* ── Master render loop — single unified 60 fps tick ───────────────── */

  useEffect(() => {
    function tick() {
      masterLoopRef.current = requestAnimationFrame(tick);

      const vA = videoARef.current;
      if (!vA || vA.paused) return;

      const t = vA.currentTime;

      // Sync drift correction — only when B exists and sync is locked
      const vB = videoBRef.current;
      if (modeRef.current !== "single" && syncLockRef.current && vB) {
        const targetBTime = t - syncOffsetRef.current;
        const bDur = isFinite(vB.duration) ? vB.duration : Infinity;
        const clampedB = Math.max(0, Math.min(bDur, targetBTime));
        if (Math.abs(vB.currentTime - clampedB) > SYNC_DRIFT_THRESHOLD) {
          vB.currentTime = clampedB;
        }
      }

      // Throttle React re-renders
      if (Math.abs(t - lastReportedTimeRef.current) < MIN_TIME_DELTA) return;
      lastReportedTimeRef.current = t;
      setCurrentTime(t);
      onTimeUpdate?.(t);
    }

    masterLoopRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(masterLoopRef.current);
  }, [onTimeUpdate]);

  /* ── Playback speed sync ───────────────────────────────────────────── */

  useEffect(() => {
    if (videoARef.current) videoARef.current.playbackRate = playbackSpeed;
    if (videoBRef.current) videoBRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  /* ── Sync lock toggle — captures A-B offset when turning ON ─────────── */

  const handleSyncLockToggle = useCallback(() => {
    setSyncLock((prev) => {
      if (!prev) {
        const vA = videoARef.current;
        const vB = videoBRef.current;
        if (vA && vB) {
          const offset = vA.currentTime - vB.currentTime;
          setSyncOffset(offset);
          syncOffsetRef.current = offset;
        }
      }
      return !prev;
    });
  }, []);

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

  const play = useCallback(() => {
    const vA = videoARef.current;
    if (!vA || !vA.paused) return;
    vA.play();
    if (syncLock && videoBRef.current) videoBRef.current.play();
    setIsPlaying(true);
  }, [syncLock]);

  const pause = useCallback(() => {
    const vA = videoARef.current;
    if (!vA || vA.paused) return;
    vA.pause();
    if (videoBRef.current) videoBRef.current.pause();
    setIsPlaying(false);
  }, []);

  /* ── Seek Video A — propagates to B via offset when sync is ON ─────── */

  const seekTo = useCallback(
    (time: number) => {
      const snapped = snapToFrame(time, ANALYSIS_FPS);
      const clamped = Math.max(0, Math.min(duration, snapped));

      if (videoARef.current) videoARef.current.currentTime = clamped;

      if (syncLock && videoBRef.current) {
        const vB = videoBRef.current;
        const bDur = isFinite(vB.duration) ? vB.duration : 0;
        const bTarget = clamped - syncOffsetRef.current;
        vB.currentTime = Math.max(0, Math.min(bDur, bTarget));
      }

      setCurrentTime(clamped);
      onTimeUpdate?.(clamped);
    },
    [duration, syncLock, onTimeUpdate]
  );

  /* ── Seek Video B independently (unlinked mode, B active panel) ─────── */

  const seekB = useCallback((time: number) => {
    const vB = videoBRef.current;
    if (!vB) return;
    const bDur = isFinite(vB.duration) ? vB.duration : 0;
    const snapped = snapToFrame(time, ANALYSIS_FPS);
    const clamped = Math.max(0, Math.min(bDur, snapped));
    vB.currentTime = clamped;
    setBCurrentTime(clamped);
  }, []);

  /** Handle frame index changes from JogWheel in frame-perfect mode */
  const handleFrameChange = useCallback(
    (index: number) => {
      setCurrentFrameIndex(index);
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

      // Unlinked split mode with B active: step only Video B
      if (mode === "split" && !linked && activePanel === "B") {
        const vB = videoBRef.current;
        if (!vB) return;
        vB.pause();
        setIsPlaying(false);
        const bDur = isFinite(vB.duration) ? vB.duration : 0;
        const next = snapToFrame(
          vB.currentTime + dir * FRAME_STEP,
          ANALYSIS_FPS
        );
        const clamped = Math.max(0, Math.min(bDur, next));
        vB.currentTime = clamped;
        setBCurrentTime(clamped);
        return;
      }

      const vA = videoARef.current;
      if (!vA) return;

      // Pause during frame stepping
      vA.pause();
      if (videoBRef.current) videoBRef.current.pause();
      setIsPlaying(false);

      const next = snapToFrame(
        vA.currentTime + dir * FRAME_STEP,
        ANALYSIS_FPS
      );
      const clamped = Math.max(0, Math.min(duration, next));

      vA.currentTime = clamped;

      if (syncLock && videoBRef.current) {
        const vB = videoBRef.current;
        const bDur = isFinite(vB.duration) ? vB.duration : 0;
        const bTarget = clamped - syncOffsetRef.current;
        vB.currentTime = Math.max(0, Math.min(bDur, bTarget));
      }

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
      mode,
      linked,
      activePanel,
    ]
  );

  const stepForward = useCallback(() => frameStep(1), [frameStep]);
  const stepBackward = useCallback(() => frameStep(-1), [frameStep]);

  /* ── Re-sync — snaps B to its offset-corrected position ────────────── */

  const reSync = useCallback(() => {
    const vA = videoARef.current;
    const vB = videoBRef.current;
    if (vA && vB) {
      const bDur = isFinite(vB.duration) ? vB.duration : 0;
      const bTarget = vA.currentTime - syncOffsetRef.current;
      vB.currentTime = Math.max(0, Math.min(bDur, bTarget));
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
        const extractionSrc = videoA.transcodedUrl ?? videoA.src;
        frameExtractor.extract(extractionSrc);
      }
      // Pause video during frame-perfect mode
      if (videoARef.current && !videoARef.current.paused) {
        videoARef.current.pause();
        if (videoBRef.current) videoBRef.current.pause();
        setIsPlaying(false);
      }
      setCurrentFrameIndex(timeToFrameIndex(currentTime, ANALYSIS_FPS));
      setFramePerfectMode(true);
    }
  }, [
    framePerfectMode,
    currentFrameIndex,
    currentTime,
    frameExtractor,
    videoA.src,
    videoA.transcodedUrl,
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

  /* ── Toggle helpers ────────────────────────────────────────────────── */

  const toggleSpatialLock = useCallback(
    () => setSpatialLock((v) => !v),
    []
  );

  const toggleLinked = useCallback(() => {
    setLinked((prev) => {
      if (!prev) setActivePanel("A"); // reset to A when re-linking
      return !prev;
    });
  }, []);

  const setGhostOpacity = useCallback(
    (v: number) => {
      onGhostOpacityChange?.(v);
    },
    [onGhostOpacityChange]
  );

  const setSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
  }, []);

  /* ── Computed ───────────────────────────────────────────────────────── */

  const progress = framePerfectActive
    ? frameExtractor.totalFrames > 1
      ? (currentFrameIndex / (frameExtractor.totalFrames - 1)) * 100
      : 0
    : duration > 0
      ? (currentTime / duration) * 100
      : 0;

  const hasVideoB = !!videoB && mode !== "single";
  const jogWheelTargetsB = mode === "split" && !linked && activePanel === "B";

  /* ── Memoized context value ────────────────────────────────────────── */

  const value: VideoWorkspaceState = useMemo(
    () => ({
      // Playback state
      currentTime,
      duration,
      isPlaying,
      playbackSpeed,
      mode,
      ghostOpacity: ghostOpacityProp,

      // Frame-perfect mode
      framePerfectMode,
      framePerfectActive,
      currentFrameIndex,
      frameExtractor,

      // Sync & linking
      syncLock,
      syncOffset,
      spatialLock,
      linked,
      activePanel,
      bCurrentTime,
      bDuration,

      // Zoom/Pan
      zoomPanA,
      zoomPanB,
      leaderZoomState,

      // Playback actions
      seekTo,
      seekB,
      play,
      pause,
      togglePlay,
      setSpeed,
      stepForward,
      stepBackward,
      reSync,

      // Toggle actions
      toggleSyncLock: handleSyncLockToggle,
      toggleSpatialLock,
      toggleLinked,
      toggleFramePerfect,
      setActivePanel,
      setGhostOpacity,
      handleFrameChange,

      // Speed menu UI state
      showSpeedMenu,
      setShowSpeedMenu,

      // Refs
      videoARef,
      videoBRef,

      // Computed
      progress,
      hasVideoB,
      jogWheelTargetsB,

      // Video event handlers
      handleLoadedMetadata,
      handleLoadedMetadataB,
      handleVideoBTimeUpdate,
      handleVideoAPlay,
      handleVideoAPause,

      // Constants
      speedOptions: SPEED_OPTIONS,
    }),
    [
      currentTime,
      duration,
      isPlaying,
      playbackSpeed,
      mode,
      ghostOpacityProp,
      framePerfectMode,
      framePerfectActive,
      currentFrameIndex,
      frameExtractor,
      syncLock,
      syncOffset,
      spatialLock,
      linked,
      activePanel,
      bCurrentTime,
      bDuration,
      zoomPanA,
      zoomPanB,
      leaderZoomState,
      seekTo,
      seekB,
      play,
      pause,
      togglePlay,
      setSpeed,
      stepForward,
      stepBackward,
      reSync,
      handleSyncLockToggle,
      toggleSpatialLock,
      toggleLinked,
      toggleFramePerfect,
      setGhostOpacity,
      handleFrameChange,
      showSpeedMenu,
      progress,
      hasVideoB,
      jogWheelTargetsB,
      handleLoadedMetadata,
      handleLoadedMetadataB,
      handleVideoBTimeUpdate,
      handleVideoAPlay,
      handleVideoAPause,
    ]
  );

  return (
    <VideoWorkspaceContext.Provider value={value}>
      {children}
    </VideoWorkspaceContext.Provider>
  );
}
