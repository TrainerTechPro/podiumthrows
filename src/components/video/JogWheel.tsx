"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { snapToFrame } from "./types";

/* ─── Types ───────────────────────────────────────────────────────────────── */

/**
 * Frame-perfect mode: JogWheel operates on a pre-extracted ImageBitmap[]
 * instead of a <video> element. Zero decode latency — array index lookup.
 */
type FrameMode = {
  /** Total number of extracted frames */
  totalFrames: number;
  /** Current frame index (0-based) */
  currentFrame: number;
  /** Callback when the frame index changes */
  onFrameChange: (index: number) => void;
};

type Props = {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  /** Seconds per pixel of drag */
  sensitivity?: number;
  /** Video FPS for frame-snapping (default 60) */
  fps?: number;
  /**
   * Direct video element ref for zero-jitter scrubbing.
   * When provided, JogWheel mutates videoElement.currentTime directly via rAF
   * during drag, completely bypassing React state. Only calls onSeek() once
   * when the drag ends (momentum settled) to sync React state.
   *
   * When NOT provided, falls back to calling onSeek() on every move (original behavior).
   */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /**
   * Frame-perfect mode: operates on pre-extracted ImageBitmap[] instead of <video>.
   * When provided, overrides both videoRef and callback modes.
   * Pixel drag maps to frame index changes with zero decode latency.
   */
  frameMode?: FrameMode;
  /**
   * When true, dragging left moves the video forward (film-strip mental model).
   * When false (default), dragging right moves the video forward (timeline mental model).
   */
  invertScroll?: boolean;
  /**
   * Scales the friction applied during momentum decay (default 1.0).
   * - 0   = stops immediately (maximum friction)
   * - 1.0 = default feel
   * - >1  = free-spinning (wheel coasts much longer)
   *
   * Effective friction is clamped to [0, 0.999] — values ≥ 1 would
   * never converge; values < 0 are nonsensical.
   */
  momentumMultiplier?: number;
  className?: string;
};

/* ─── Constants ───────────────────────────────────────────────────────────── */

const FRICTION = 0.94;
const MIN_VELOCITY = 0.1; // px/frame — stop threshold
const TICK_COUNT = 60; // visual tick marks
const TICK_SPACING = 12; // px between ticks
/** One full visual cycle of the tick strip. The major/minor pattern repeats
 *  every STRIP_CYCLE px, so modulo-wrapping is seamless. */
const STRIP_CYCLE = TICK_COUNT * TICK_SPACING; // 720 px

/* ─── Component ───────────────────────────────────────────────────────────── */

export function JogWheel({
  currentTime,
  duration,
  onSeek,
  sensitivity = 0.02,
  fps,
  videoRef,
  frameMode,
  invertScroll = false,
  momentumMultiplier = 1.0,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tickStripRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastX = useRef(0);
  const velocityRef = useRef(0);
  const rafRef = useRef<number>(0);
  const velocitySamples = useRef<{ dx: number; dt: number }[]>([]);
  const lastMoveTime = useRef(0);
  /** Track accumulated time imperatively during direct-DOM mode */
  const timeRef = useRef(currentTime);
  /** Track accumulated frame index imperatively during frame mode */
  const frameIndexRef = useRef(frameMode?.currentFrame ?? 0);
  /** Visual offset for tick strip (imperative, not React state in fast path) */
  const offsetRef = useRef(0);
  /** Mirrors momentumMultiplier prop — read inside rAF loop to avoid stale closures */
  const momentumMultiplierRef = useRef(momentumMultiplier);
  const [offset, setOffset] = useState(0);
  const [active, setActive] = useState(false);

  /** Pixels per frame in frame mode (higher = slower/more precise scrubbing) */
  const PIXELS_PER_FRAME = 5;

  // Keep timeRef in sync with prop when not dragging
  useEffect(() => {
    if (!isDragging.current) {
      timeRef.current = currentTime;
    }
  }, [currentTime]);

  // Keep frameIndexRef in sync with prop when not dragging
  useEffect(() => {
    if (!isDragging.current && frameMode) {
      frameIndexRef.current = frameMode.currentFrame;
    }
  }, [frameMode]);

  // Keep momentumMultiplierRef in sync with prop
  useEffect(() => {
    momentumMultiplierRef.current = momentumMultiplier;
  }, [momentumMultiplier]);

  /** Whether to use frame-perfect mode (highest priority) */
  const useFrameMode = !!frameMode;
  /** Whether to use direct DOM mutation (zero-jitter fast path) */
  const useDirectDOM = !useFrameMode && !!videoRef;

  /* ── Direct DOM: seek video + update tick strip without React ──────── */

  const seekDirect = useCallback(
    (delta: number) => {
      const raw = timeRef.current + delta;
      const snapped = snapToFrame(raw, fps);
      const clamped = Math.max(0, Math.min(duration, snapped));
      timeRef.current = clamped;

      // Directly mutate video element — zero React overhead
      if (videoRef?.current) {
        videoRef.current.currentTime = clamped;
      }

      // Frame-exact tick strip update.
      // frameIdx * TICK_SPACING gives an absolute pixel offset that advances by
      // exactly TICK_SPACING per frame — no floating-point drift with short clips.
      // Modulo STRIP_CYCLE keeps the value within strip bounds; wrapping is
      // visually seamless because the major/minor pattern repeats every STRIP_CYCLE px.
      if (tickStripRef.current) {
        const frameDuration = 1 / (fps ?? 60);
        const frameIdx = Math.round(clamped / frameDuration);
        const timeOffset = (frameIdx * TICK_SPACING) % STRIP_CYCLE;
        tickStripRef.current.style.transform = `translateX(${
          -timeOffset + offsetRef.current * 0.05
        }px)`;
        tickStripRef.current.style.transition = "none";
      }
    },
    [duration, fps, videoRef]
  );

  /* ── Frame mode: index into ImageBitmap[] (zero decode latency) ────── */

  const seekFrameMode = useCallback(
    (pixelDelta: number) => {
      if (!frameMode) return;
      const frameDelta = pixelDelta / PIXELS_PER_FRAME;
      const raw = frameIndexRef.current + frameDelta;
      const clamped = Math.max(0, Math.min(frameMode.totalFrames - 1, Math.round(raw)));
      frameIndexRef.current = clamped;
      frameMode.onFrameChange(clamped);

      // Update tick strip directly
      if (tickStripRef.current && frameMode.totalFrames > 1) {
        const progress = clamped / (frameMode.totalFrames - 1);
        const tickOffset = progress * TICK_COUNT * TICK_SPACING;
        tickStripRef.current.style.transform = `translateX(${
          -tickOffset + offsetRef.current * 0.05
        }px)`;
        tickStripRef.current.style.transition = "none";
      }
    },
    [frameMode]
  );

  /* ── Fallback: seek via React state (original behavior) ────────────── */

  const seekViaCallback = useCallback(
    (delta: number) => {
      const raw = currentTime + delta;
      const snapped = snapToFrame(raw, fps);
      const clamped = Math.max(0, Math.min(duration, snapped));
      onSeek(clamped);
    },
    [currentTime, duration, onSeek, fps]
  );

  /* ── Unified seek (picks fast path or fallback) ────────────────────── */

  const seek = useCallback(
    (delta: number) => {
      if (useFrameMode) {
        // In frame mode, delta is raw pixel delta — not time delta
        seekFrameMode(delta);
      } else if (useDirectDOM) {
        seekDirect(delta);
      } else {
        seekViaCallback(delta);
      }
    },
    [useFrameMode, useDirectDOM, seekFrameMode, seekDirect, seekViaCallback]
  );

  /* ── Sync React state after momentum settles ──────────────────────── */

  const syncReactState = useCallback(() => {
    if (useFrameMode && frameMode) {
      // Frame mode: final sync handled by onFrameChange during drag
      frameMode.onFrameChange(Math.round(frameIndexRef.current));
    } else if (useDirectDOM) {
      onSeek(timeRef.current);
    }
  }, [useFrameMode, frameMode, useDirectDOM, onSeek]);

  /* ── Momentum animation loop ───────────────────────────────────────── */

  const animateMomentum = useCallback(() => {
    if (Math.abs(velocityRef.current) < MIN_VELOCITY) {
      velocityRef.current = 0;
      // Momentum settled — sync React state once
      syncReactState();
      return;
    }

    // In frame mode, pass raw pixel velocity; otherwise convert to time delta
    const delta = useFrameMode
      ? velocityRef.current
      : velocityRef.current * sensitivity;
    seek(delta);

    // Apply friction scaled by momentumMultiplier (read from ref — stale-closure safe).
    // Clamped to [0, 0.999]: values ≥ 1 would prevent convergence.
    const effectiveFriction = Math.min(
      0.999,
      FRICTION * momentumMultiplierRef.current
    );
    velocityRef.current *= effectiveFriction;

    // Visual offset
    if (useDirectDOM || useFrameMode) {
      offsetRef.current += velocityRef.current;
    } else {
      setOffset((prev) => prev + velocityRef.current);
    }

    rafRef.current = requestAnimationFrame(animateMomentum);
  }, [seek, sensitivity, syncReactState, useDirectDOM, useFrameMode]);

  /* ── Pointer start ─────────────────────────────────────────────────── */

  const handleStart = useCallback(
    (clientX: number) => {
      isDragging.current = true;
      lastX.current = clientX;
      velocityRef.current = 0;
      velocitySamples.current = [];
      lastMoveTime.current = performance.now();

      if (useFrameMode && frameMode) {
        frameIndexRef.current = frameMode.currentFrame;
      } else {
        timeRef.current = useDirectDOM
          ? videoRef?.current?.currentTime ?? currentTime
          : currentTime;
      }

      setActive(true);

      // Cancel any existing momentum animation
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [currentTime, useDirectDOM, useFrameMode, frameMode, videoRef]
  );

  /* ── Pointer move ──────────────────────────────────────────────────── */

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDragging.current) return;

      const rawDx = clientX - lastX.current;
      const now = performance.now();
      const dt = now - lastMoveTime.current;

      lastX.current = clientX;
      lastMoveTime.current = now;

      // Apply scroll direction — inverted flips the film-strip mental model
      const dx = invertScroll ? -rawDx : rawDx;

      // Track velocity samples (keep last 5) — uses effective dx so momentum inherits inversion
      velocitySamples.current.push({ dx, dt });
      if (velocitySamples.current.length > 5) velocitySamples.current.shift();

      // In frame mode, pass raw pixel delta; otherwise convert to time delta
      const delta = useFrameMode ? dx : dx * sensitivity;
      seek(delta);

      // Visual offset tracks effective dx so ticks move with mental model
      if (useDirectDOM || useFrameMode) {
        offsetRef.current += dx;
      } else {
        setOffset((prev) => prev + dx);
      }
    },
    [seek, sensitivity, useDirectDOM, useFrameMode, invertScroll]
  );

  /* ── Pointer end ───────────────────────────────────────────────────── */

  const handleEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setActive(false);

    // Calculate average velocity from samples
    const samples = velocitySamples.current;
    if (samples.length > 0) {
      const totalDx = samples.reduce((sum, s) => sum + s.dx, 0);
      const totalDt = samples.reduce((sum, s) => sum + s.dt, 0);
      if (totalDt > 0) {
        velocityRef.current = (totalDx / totalDt) * 16; // normalize to ~60fps
      }
    }

    // Start momentum if velocity is significant
    if (Math.abs(velocityRef.current) > MIN_VELOCITY) {
      rafRef.current = requestAnimationFrame(animateMomentum);
    } else {
      // No momentum — sync React state immediately
      syncReactState();
    }

    // Haptic feedback on release
    if (Math.abs(velocityRef.current) > 2 && navigator.vibrate) {
      navigator.vibrate(5);
    }
  }, [animateMomentum, syncReactState]);

  /* ── Keyboard: ArrowLeft / ArrowRight step one frame ───────────────── */

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const frameDuration = 1 / (fps ?? 60);
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = snapToFrame(
        Math.max(0, Math.min(duration, currentTime + dir * frameDuration)),
        fps
      );
      onSeek(next);
    },
    [currentTime, duration, fps, onSeek]
  );

  /* ── Mouse event wrappers ──────────────────────────────────────────── */

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      handleStart(e.clientX);
    },
    [handleStart]
  );

  // Track mouse globally for smooth dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleGlobalMouseUp = () => handleEnd();

    if (active) {
      document.addEventListener("mousemove", handleGlobalMouseMove);
      document.addEventListener("mouseup", handleGlobalMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [active, handleMove, handleEnd]);

  /* ── Touch event wrappers ──────────────────────────────────────────── */

  const handleTouchStart = useCallback(
    (e: ReactTouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleStart(touch.clientX);
    },
    [handleStart]
  );

  const handleTouchMove = useCallback(
    (e: ReactTouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleMove(touch.clientX);
    },
    [handleMove]
  );

  const handleTouchEnd = useCallback(
    (e: ReactTouchEvent) => {
      e.preventDefault();
      handleEnd();
    },
    [handleEnd]
  );

  /* ── Cleanup ───────────────────────────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /* ── Render ────────────────────────────────────────────────────────── */

  // Frame-exact tick offset: each frame advances exactly TICK_SPACING pixels,
  // eliminating sub-pixel drift that occurs with the old (currentTime/duration)
  // percentage formula on short clips. Modulo STRIP_CYCLE keeps the value in
  // bounds — wraps are seamless because the tick pattern repeats every STRIP_CYCLE px.
  const frameDuration = 1 / (fps ?? 60);
  const frameIndex = Math.round(currentTime / frameDuration);
  const timeOffset = (frameIndex * TICK_SPACING) % STRIP_CYCLE;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      aria-label="Video scrubber — use arrow keys to step frames"
      className={`relative h-10 overflow-hidden select-none touch-none outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 focus-visible:ring-offset-black rounded ${className ?? ""}`}
      style={{ cursor: active ? "grabbing" : "grab" }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
    >
      {/* Gradient fade edges */}
      <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />

      {/* Tick strip — uses ref for direct DOM mutation in fast path */}
      <div
        ref={tickStripRef}
        className="absolute inset-y-0 flex items-center"
        style={{
          transform: `translateX(${-timeOffset + offset * 0.05}px)`,
          transition: active ? "none" : "transform 0.1s ease-out",
        }}
      >
        {Array.from({ length: TICK_COUNT * 2 }, (_, i) => {
          const isMajor = i % 5 === 0;
          return (
            <div
              key={i}
              className="shrink-0 flex items-center justify-center"
              style={{ width: TICK_SPACING }}
            >
              <div
                className={`rounded-full transition-colors ${
                  isMajor
                    ? "w-0.5 h-4 bg-white/40"
                    : "w-px h-2.5 bg-white/15"
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Center indicator line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-primary-500 z-20 pointer-events-none">
        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary-500 rounded-full" />
      </div>

      {/* Active glow */}
      {active && (
        <div className="absolute inset-0 bg-primary-500/5 pointer-events-none rounded" />
      )}
    </div>
  );
}
