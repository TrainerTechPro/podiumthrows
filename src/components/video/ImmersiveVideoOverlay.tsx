"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { AnnotationCanvas } from "./AnnotationCanvas";
import { ImmersiveAnnotationToolbar } from "./ImmersiveAnnotationToolbar";
import { ImmersiveScrubBar } from "./ImmersiveScrubBar";
import { VoiceNarrationRecorder } from "./VoiceNarrationRecorder";
import { ZoomableVideoContainer } from "./ZoomableVideoContainer";
import { useZoomPan } from "./useZoomPan";
import { PoseOverlay } from "./PoseOverlay";
import { usePoseDetection } from "./usePoseDetection";
import {
  PLAYBACK_SPEEDS,
  FRAME_STEP,
  snapToFrame,
  type Annotation,
  type AnnotationTool,
} from "./types";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  open: boolean;
  onClose: () => void;
  videoSrc: string;
  poster?: string;
  title?: string;
  annotations: Annotation[];
  onAnnotationsChange?: (anns: Annotation[]) => void;
  isEditing: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  initialTime?: number;
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function ImmersiveVideoOverlay({
  open,
  onClose,
  videoSrc,
  poster,
  title,
  annotations: parentAnnotations,
  onAnnotationsChange,
  isEditing,
  onSave,
  isSaving = false,
  initialTime = 0,
}: Props) {
  /* ── Refs ────────────────────────────────────────────────────────── */
  const videoRef = useRef<HTMLVideoElement>(null);

  /* ── Video state ────────────────────────────────────────────────── */
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  /* ── Annotation state (local copy) ──────────────────────────────── */
  const [localAnnotations, setLocalAnnotations] = useState<Annotation[]>([]);
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("select");
  const [activeColor, setActiveColor] = useState("#ef4444");
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(4);

  /* ── Voice narration state ──────────────────────────────────────── */
  const [isNarrating, setIsNarrating] = useState(false);
  const [narrationBlob, setNarrationBlob] = useState<Blob | null>(null);

  /* ── Zoom/pan state ───────────────────────────────────────────── */
  const zoomPan = useZoomPan({
    enabled: open,
    isDrawingActive: isEditing && activeTool !== "select",
    maxScale: 5,
  });

  /* ── Pose detection state ────────────────────────────────────── */
  const poseDetection = usePoseDetection();
  const [showAngles, setShowAngles] = useState(true);

  /* ── Initialize on open ─────────────────────────────────────────── */

  useEffect(() => {
    if (!open) return;
    // Copy parent annotations into local state
    setLocalAnnotations([...parentAnnotations]);
    setUndoStack([]);
    setRedoStack([]);
    setActiveTool("select");
    setIsNarrating(false);
    setNarrationBlob(null);
    setShowSpeedMenu(false);
    zoomPan.resetZoom();
  }, [open, parentAnnotations]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !videoRef.current) return;
    const video = videoRef.current;
    const handleLoaded = () => {
      video.currentTime = initialTime;
      setDuration(video.duration || 0);
    };
    if (video.readyState >= 1) {
      handleLoaded();
    } else {
      video.addEventListener("loadedmetadata", handleLoaded, { once: true });
    }
  }, [open, initialTime]);

  /* ── Body scroll lock ───────────────────────────────────────────── */

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* ── Close handler (sync annotations back) ──────────────────────── */

  const handleClose = useCallback(() => {
    if (isEditing && onAnnotationsChange) {
      onAnnotationsChange(localAnnotations);
    }
    onClose();
  }, [isEditing, onAnnotationsChange, localAnnotations, onClose]);

  /* ── Keyboard shortcuts ─────────────────────────────────────────── */

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      switch (e.key) {
        case "Escape":
          handleClose();
          break;
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
        case "l":
          e.preventDefault();
          setLooping((prev) => !prev);
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBy(-5);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekBy(5);
          break;
        case "=":
        case "+":
          e.preventDefault();
          zoomPan.zoomIn();
          break;
        case "-":
          e.preventDefault();
          zoomPan.zoomOut();
          break;
        case "0":
          e.preventDefault();
          zoomPan.resetZoom();
          break;
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, handleClose]);

  /* ── Video controls ─────────────────────────────────────────────── */

  function togglePlay() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  }

  function frameStep(direction: 1 | -1) {
    if (!videoRef.current) return;
    videoRef.current.pause();
    // Snap to exact 60fps frame boundary
    const raw = videoRef.current.currentTime + direction * FRAME_STEP;
    videoRef.current.currentTime = snapToFrame(raw);
  }

  function seekBy(seconds: number) {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(
      0,
      Math.min(duration, videoRef.current.currentTime + seconds)
    );
  }

  function seekTo(time: number) {
    if (videoRef.current) videoRef.current.currentTime = time;
  }

  function changeSpeed(s: number) {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
    setShowSpeedMenu(false);
  }

  /* ── Video event handlers ───────────────────────────────────────── */

  const handleTimeUpdate = useCallback(() => {
    setCurrentTime(videoRef.current?.currentTime ?? 0);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    setDuration(videoRef.current?.duration ?? 0);
  }, []);

  const handlePlay = useCallback(() => setPlaying(true), []);
  const handlePause = useCallback(() => setPlaying(false), []);
  const handleEnded = useCallback(() => {
    if (looping && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    } else {
      setPlaying(false);
    }
  }, [looping]);

  /* ── Annotation management ──────────────────────────────────────── */

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev, localAnnotations]);
    setRedoStack([]);
  }, [localAnnotations]);

  const addAnnotation = useCallback(
    (ann: Annotation) => {
      pushUndo();
      setLocalAnnotations((prev) => [...prev, ann]);
    },
    [pushUndo]
  );

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((s) => [...s, localAnnotations]);
    setUndoStack((s) => s.slice(0, -1));
    setLocalAnnotations(prev);
  }, [undoStack, localAnnotations]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((s) => [...s, localAnnotations]);
    setRedoStack((s) => s.slice(0, -1));
    setLocalAnnotations(next);
  }, [redoStack, localAnnotations]);

  const clearAll = useCallback(() => {
    if (localAnnotations.length === 0) return;
    pushUndo();
    setLocalAnnotations([]);
  }, [localAnnotations, pushUndo]);

  /* ── Pose detection: detect on current frame when paused ────────── */

  useEffect(() => {
    if (!poseDetection.active || !videoRef.current || playing) return;
    // Detect on the current paused frame
    poseDetection.detectFrame(videoRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poseDetection.active, playing, currentTime]);

  const handlePoseToggle = useCallback(async () => {
    if (!poseDetection.active) {
      // First time: initialize model, then activate
      await poseDetection.initialize();
      poseDetection.toggle();
      // Detect immediately on current frame
      if (videoRef.current) {
        poseDetection.detectFrame(videoRef.current);
      }
    } else {
      poseDetection.toggle();
    }
  }, [poseDetection]);

  /* ── Close speed menu on outside click ──────────────────────────── */

  useEffect(() => {
    if (!showSpeedMenu) return;
    const handler = () => setShowSpeedMenu(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showSpeedMenu]);

  /* ── Render ─────────────────────────────────────────────────────── */

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black flex flex-col select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Immersive video review"
    >
      {/* ═══════ Top Bar ═══════ */}
      <div className="h-12 flex items-center gap-3 px-4 shrink-0">
        {/* Close */}
        <button
          onClick={handleClose}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close immersive view"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Title */}
        {title && (
          <span className="text-sm font-medium text-white/80 truncate flex-1 min-w-0">
            {title}
          </span>
        )}
        {!title && <div className="flex-1" />}

        {/* Loop toggle */}
        <button
          onClick={() => setLooping((prev) => !prev)}
          className={`p-2 rounded-xl transition-colors ${
            looping
              ? "text-primary-400 bg-primary-500/20"
              : "text-white/70 hover:text-white hover:bg-white/10"
          }`}
          title={`Loop ${looping ? "on" : "off"} (L)`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </button>

        {/* AI Pose detection toggle */}
        <button
          onClick={handlePoseToggle}
          disabled={poseDetection.loading}
          className={`p-2 rounded-xl transition-colors ${
            poseDetection.active
              ? "text-green-400 bg-green-500/20"
              : "text-white/70 hover:text-white hover:bg-white/10"
          } disabled:opacity-50`}
          title={
            poseDetection.loading
              ? "Loading AI model…"
              : poseDetection.active
                ? "Hide pose skeleton"
                : "Show AI pose skeleton"
          }
        >
          {poseDetection.loading ? (
            <svg width="18" height="18" viewBox="0 0 24 24" className="animate-spin">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="32" strokeLinecap="round" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Stick figure icon */}
              <circle cx="12" cy="4" r="2" />
              <line x1="12" y1="6" x2="12" y2="14" />
              <line x1="12" y1="8" x2="8" y2="12" />
              <line x1="12" y1="8" x2="16" y2="12" />
              <line x1="12" y1="14" x2="9" y2="20" />
              <line x1="12" y1="14" x2="15" y2="20" />
            </svg>
          )}
        </button>

        {/* Angle toggle (when pose active) */}
        {poseDetection.active && (
          <button
            onClick={() => setShowAngles((prev) => !prev)}
            className={`px-2 py-1 rounded-xl text-[10px] font-medium transition-colors ${
              showAngles
                ? "text-green-400 bg-green-500/20"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
            title={showAngles ? "Hide joint angles" : "Show joint angles"}
          >
            {showAngles ? "∠ On" : "∠ Off"}
          </button>
        )}

        {/* Mic (editing only) */}
        {isEditing && (
          <VoiceNarrationRecorder
            isRecording={isNarrating}
            onStartRecording={() => setIsNarrating(true)}
            onStopRecording={(blob) => {
              setIsNarrating(false);
              setNarrationBlob(blob);
            }}
          />
        )}

        {/* Save (editing only) */}
        {isEditing && onSave && (
          <button
            onClick={() => {
              onAnnotationsChange?.(localAnnotations);
              onSave();
            }}
            disabled={isSaving}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        )}
      </div>

      {/* ═══════ Video Area ═══════ */}
      <div className="flex-1 relative overflow-hidden">
        {/* Zoomable container wraps video + annotation canvas */}
        <ZoomableVideoContainer
          zoomPan={zoomPan}
          showIndicator={true}
          className="w-full h-full"
        >
          <video
            ref={videoRef}
            src={videoSrc}
            poster={poster}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onClick={togglePlay}
            playsInline
            preload="metadata"
          />

          {/* Pose skeleton overlay — scales with zoom, behind annotations */}
          {poseDetection.active && (
            <PoseOverlay
              pose={poseDetection.pose}
              showAngles={showAngles}
              color="#00ff88"
              jointColor="#ffffff"
              lineWidth={2.5}
            />
          )}

          {/* Annotation canvas overlay — scales with zoom */}
          <div className="absolute inset-0 pointer-events-none [&>*]:pointer-events-auto">
            <AnnotationCanvas
              annotations={localAnnotations}
              currentTime={currentTime}
              isEditing={isEditing}
              activeTool={activeTool}
              activeColor={activeColor}
              activeStrokeWidth={activeStrokeWidth}
              onAnnotationAdd={isEditing ? addAnnotation : undefined}
            />
          </div>
        </ZoomableVideoContainer>

        {/* ── Overlays OUTSIDE zoom container (don't scale) ── */}

        {/* Immersive annotation toolbar (editing only) */}
        {isEditing && (
          <ImmersiveAnnotationToolbar
            activeTool={activeTool}
            activeColor={activeColor}
            activeStrokeWidth={activeStrokeWidth}
            onToolChange={setActiveTool}
            onColorChange={setActiveColor}
            onStrokeWidthChange={setActiveStrokeWidth}
            onUndo={undo}
            onRedo={redo}
            onClear={clearAll}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            annotationCount={localAnnotations.length}
          />
        )}

        {/* Play button overlay (when paused) */}
        {!playing && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/10 transition-colors hover:bg-black/20"
          >
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="white"
                className="ml-1"
              >
                <polygon points="5 3 19 12 5 21" />
              </svg>
            </div>
          </button>
        )}

        {/* Narration recording indicator */}
        {narrationBlob && (
          <div className="absolute top-3 left-3 z-40 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            </svg>
            <span className="text-[10px] text-green-400 font-medium">Narration recorded</span>
          </div>
        )}

        {/* Pose detection error indicator */}
        {poseDetection.error && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 bg-red-500/80 backdrop-blur-sm rounded-lg px-3 py-1.5">
            <span className="text-[10px] text-white font-medium">
              Pose detection error: {poseDetection.error}
            </span>
          </div>
        )}
      </div>

      {/* ═══════ Bottom Controls ═══════ */}
      <div className="shrink-0 pb-[env(safe-area-inset-bottom,8px)]">
        {/* Scrub bar with annotation markers + jog wheel */}
        <ImmersiveScrubBar
          currentTime={currentTime}
          duration={duration}
          annotations={localAnnotations}
          onSeek={seekTo}
        />

        {/* Control row */}
        <div className="flex items-center justify-center gap-4 px-4 py-2">
          {/* Frame back */}
          <button
            onClick={() => frameStep(-1)}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Previous frame (,)"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="11 19 2 12 11 5" />
              <line x1="2" y1="12" x2="22" y2="12" />
            </svg>
          </button>

          {/* Play/Pause (large) */}
          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            title={playing ? "Pause (Space)" : "Play (Space)"}
          >
            {playing ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                <polygon points="5 3 19 12 5 21" />
              </svg>
            )}
          </button>

          {/* Frame forward */}
          <button
            onClick={() => frameStep(1)}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Next frame (.)"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="13 5 22 12 13 19" />
              <line x1="22" y1="12" x2="2" y2="12" />
            </svg>
          </button>

          {/* Speed */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSpeedMenu(!showSpeedMenu);
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-mono text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Playback speed"
            >
              {speed}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl py-1 shadow-2xl z-10">
                {PLAYBACK_SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={(e) => {
                      e.stopPropagation();
                      changeSpeed(s);
                    }}
                    className={`block w-full text-left px-4 py-1.5 text-xs hover:bg-white/10 transition-colors ${
                      speed === s ? "text-primary-400" : "text-white"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
