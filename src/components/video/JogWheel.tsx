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
  /** Seconds per pixel of drag (base sensitivity — now dynamically scaled) */
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
   * Maps to a decay rate for time-based exponential decay.
   */
  momentumMultiplier?: number;
  className?: string;
};

/* ─── Constants ───────────────────────────────────────────────────────────── */

const TICK_COUNT = 60; // visual tick marks
const TICK_SPACING = 12; // px between ticks
/** One full visual cycle of the tick strip. The major/minor pattern repeats
 *  every STRIP_CYCLE px, so modulo-wrapping is seamless. */
const STRIP_CYCLE = TICK_COUNT * TICK_SPACING; // 720 px

/* ── Physics constants ──────────────────────────────────────────────────── */

/** Max release velocity in px/sec. Prevents absurd spikes from touch jitter. */
const MAX_VELOCITY_PX_SEC = 5000;
/** Base exponential decay rate (per second). Higher = faster stop.
 *  ~4.0 ≈ iOS scroll deceleration feel. */
const BASE_DECAY_RATE = 4.0;
/** Velocity (px/sec) below which momentum stops. */
const MIN_VELOCITY_PX_SEC = 8;
/** How far back (ms) to look when computing release velocity. */
const VELOCITY_WINDOW_MS = 100;
/** Below this drag speed (px/sec), lock to surgical 1-frame-per-N-pixels. */
const SURGICAL_SPEED_THRESHOLD = 50;
/** Dynamic sensitivity multiplier growth rate per px/sec above the surgical threshold. */
const SENSITIVITY_GROWTH = 0.005;

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
  const velocityRef = useRef(0); // px/sec during momentum
  const rafRef = useRef<number>(0);

  /** Unbounded array of {x, time} recorded during a drag gesture. */
  const trackPoints = useRef<{ x: number; time: number }[]>([]);

  /** Track accumulated time imperatively during direct-DOM mode */
  const timeRef = useRef(currentTime);
  /** Track accumulated frame index imperatively during frame mode */
  const frameIndexRef = useRef(frameMode?.currentFrame ?? 0);
  /** Visual offset for tick strip (imperative, not React state in fast path) */
  const offsetRef = useRef(0);
  /** Mirrors momentumMultiplier prop — read inside rAF loop to avoid stale closures */
  const momentumMultiplierRef = useRef(momentumMultiplier);

  /** Sub-frame accumulator: collects fractional-frame time deltas. Only commits
   *  to the video element when a full frame boundary is crossed. */
  const timeAccumulator = useRef(0);
  /** Sub-frame accumulator for frame-mode (fractional frame index deltas). */
  const frameAccumulator = useRef(0);

  /** Timestamp (performance.now) when the user released the drag. Used by
   *  time-based exponential decay so momentum is frame-rate independent. */
  const releaseTimeRef = useRef(0);
  /** The initial velocity at release, preserved for the decay formula. */
  const releaseVelocityRef = useRef(0);

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

  /* ── Dynamic sensitivity ──────────────────────────────────────────────── */

  /**
   * Returns a sensitivity multiplier that scales with instantaneous drag speed.
   * - Below SURGICAL_SPEED_THRESHOLD: returns baseSensitivity unchanged (surgical).
   * - Above: grows linearly so fast swipes jump whole seconds.
   */
  const calculateDynamicSensitivity = useCallback(
    (speedPxSec: number): number => {
      const absSpeed = Math.abs(speedPxSec);
      if (absSpeed < SURGICAL_SPEED_THRESHOLD) return sensitivity;
      return sensitivity * (1 + absSpeed * SENSITIVITY_GROWTH);
    },
    [sensitivity]
  );

  /* ── Direct DOM: seek video + update tick strip without React ──────── */

  const seekDirect = useCallback(
    (timeDelta: number) => {
      const frameDur = 1 / (fps ?? 60);

      // Accumulate the fractional-frame delta
      timeAccumulator.current += timeDelta;

      // Only commit when we've crossed a full frame boundary
      if (Math.abs(timeAccumulator.current) < frameDur) return;

      // Consume full frames from the accumulator, leave the remainder
      const framesToAdvance =
        Math.trunc(timeAccumulator.current / frameDur) * frameDur;
      timeAccumulator.current -= framesToAdvance;

      const raw = timeRef.current + framesToAdvance;
      const snapped = snapToFrame(raw, fps);
      const clamped = Math.max(0, Math.min(duration, snapped));
      timeRef.current = clamped;

      // Directly mutate video element — zero React overhead
      if (videoRef?.current) {
        videoRef.current.currentTime = clamped;
      }

      // Frame-exact tick strip update
      if (tickStripRef.current) {
        const frameIdx = Math.round(clamped / frameDur);
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

      // Accumulate fractional frame deltas
      frameAccumulator.current += pixelDelta / PIXELS_PER_FRAME;

      // Only commit when a full frame boundary is crossed
      if (Math.abs(frameAccumulator.current) < 1) return;

      const framesToAdvance = Math.trunc(frameAccumulator.current);
      frameAccumulator.current -= framesToAdvance;

      const raw = frameIndexRef.current + framesToAdvance;
      const clamped = Math.max(
        0,
        Math.min(frameMode.totalFrames - 1, raw)
      );
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
    (timeDelta: number) => {
      const frameDur = 1 / (fps ?? 60);

      // Sub-frame accumulator for callback mode too
      timeAccumulator.current += timeDelta;
      if (Math.abs(timeAccumulator.current) < frameDur) return;

      const framesToAdvance =
        Math.trunc(timeAccumulator.current / frameDur) * frameDur;
      timeAccumulator.current -= framesToAdvance;

      const raw = currentTime + framesToAdvance;
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
    // Flush any remaining accumulator
    timeAccumulator.current = 0;
    frameAccumulator.current = 0;

    if (useFrameMode && frameMode) {
      frameMode.onFrameChange(Math.round(frameIndexRef.current));
    } else if (useDirectDOM) {
      onSeek(timeRef.current);
    }
  }, [useFrameMode, frameMode, useDirectDOM, onSeek]);

  /* ── Momentum animation loop (time-based exponential decay) ─────────── */

  const animateMomentum = useCallback(() => {
    const elapsed = (performance.now() - releaseTimeRef.current) / 1000; // seconds

    // Effective decay rate: scaled inversely by momentumMultiplier.
    // multiplier > 1 = slower decay (more coast), < 1 = faster decay.
    const mult = Math.max(0.01, momentumMultiplierRef.current);
    const effectiveDecay = BASE_DECAY_RATE / mult;

    // v(t) = v0 * e^(-k*t)  —  frame-rate independent
    const v = releaseVelocityRef.current * Math.exp(-effectiveDecay * elapsed);
    velocityRef.current = v;

    if (Math.abs(v) < MIN_VELOCITY_PX_SEC) {
      velocityRef.current = 0;
      syncReactState();
      return;
    }

    // dt since last rAF frame (approximate via decay derivative integration).
    // displacement between t and t+dt: integral of v0*e^(-k*t) dt = v0/k * (1 - e^(-k*dt))
    // For per-frame delta we use the instantaneous velocity * assumed ~16ms.
    // But to stay truly frame-rate independent, compute displacement since last call:
    const dtFrame = 1 / 60; // approximate frame interval; error is cosmetic only
    const displacement = v * dtFrame; // px moved this frame

    // Dynamic sensitivity during momentum too
    const dynSens = calculateDynamicSensitivity(v);
    const timeDelta = useFrameMode ? displacement : displacement * dynSens;
    seek(timeDelta);

    // Visual offset
    if (useDirectDOM || useFrameMode) {
      offsetRef.current += displacement;
    } else {
      setOffset((prev) => prev + displacement);
    }

    rafRef.current = requestAnimationFrame(animateMomentum);
  }, [seek, calculateDynamicSensitivity, syncReactState, useDirectDOM, useFrameMode]);

  /* ── Pointer start ─────────────────────────────────────────────────── */

  const handleStart = useCallback(
    (clientX: number) => {
      isDragging.current = true;
      lastX.current = clientX;
      velocityRef.current = 0;
      timeAccumulator.current = 0;
      frameAccumulator.current = 0;
      trackPoints.current = [{ x: clientX, time: performance.now() }];

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

      const now = performance.now();
      const rawDx = clientX - lastX.current;
      lastX.current = clientX;

      // Apply scroll direction — inverted flips the film-strip mental model
      const dx = invertScroll ? -rawDx : rawDx;

      // Record tracking point (unbounded — pruned only at release)
      trackPoints.current.push({ x: clientX, time: now });

      // Instantaneous speed for dynamic sensitivity (px/sec).
      // Use the last two track points to get a stable estimate.
      const pts = trackPoints.current;
      let instantSpeed = 0;
      if (pts.length >= 2) {
        const prev = pts[pts.length - 2];
        const curr = pts[pts.length - 1];
        const dtMs = curr.time - prev.time;
        if (dtMs > 0) {
          instantSpeed = Math.abs(curr.x - prev.x) / (dtMs / 1000);
        }
      }

      const dynSens = calculateDynamicSensitivity(instantSpeed);

      // In frame mode, pass raw pixel delta; otherwise convert to time delta
      const delta = useFrameMode ? dx : dx * dynSens;
      seek(delta);

      // Visual offset tracks effective dx so ticks move with mental model
      if (useDirectDOM || useFrameMode) {
        offsetRef.current += dx;
      } else {
        setOffset((prev) => prev + dx);
      }
    },
    [seek, calculateDynamicSensitivity, useDirectDOM, useFrameMode, invertScroll]
  );

  /* ── Pointer end ───────────────────────────────────────────────────── */

  const handleEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setActive(false);

    // ── 100ms window velocity calculation ───────────────────────────
    const now = performance.now();
    const cutoff = now - VELOCITY_WINDOW_MS;
    const pts = trackPoints.current;

    let releaseVelocity = 0;
    if (pts.length >= 2) {
      // Walk backward to find the oldest point still within the 100ms window
      let startIdx = pts.length - 1;
      for (let i = pts.length - 1; i >= 0; i--) {
        if (pts[i].time < cutoff) break;
        startIdx = i;
      }

      const first = pts[startIdx];
      const last = pts[pts.length - 1];
      const dtMs = last.time - first.time;

      if (dtMs > 0) {
        const dxRaw = last.x - first.x;
        const dx = invertScroll ? -dxRaw : dxRaw;
        releaseVelocity = (dx / dtMs) * 1000; // px/sec
      }
    }

    // Hard clamp
    releaseVelocity = Math.max(
      -MAX_VELOCITY_PX_SEC,
      Math.min(MAX_VELOCITY_PX_SEC, releaseVelocity)
    );

    velocityRef.current = releaseVelocity;
    releaseVelocityRef.current = releaseVelocity;
    releaseTimeRef.current = performance.now();

    // Clear track points
    trackPoints.current = [];

    // Start momentum if velocity is significant
    if (Math.abs(releaseVelocity) > MIN_VELOCITY_PX_SEC) {
      rafRef.current = requestAnimationFrame(animateMomentum);
    } else {
      // No momentum — sync React state immediately
      syncReactState();
    }

    // Haptic feedback on release
    if (Math.abs(releaseVelocity) > 100 && navigator.vibrate) {
      navigator.vibrate(5);
    }
  }, [animateMomentum, syncReactState, invertScroll]);

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
