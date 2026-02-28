"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { snapToFrame } from "./types";

/* ─── Types ───────────────────────────────────────────────────────────────── */

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
  className?: string;
};

/* ─── Constants ───────────────────────────────────────────────────────────── */

const FRICTION = 0.94;
const MIN_VELOCITY = 0.1; // px/frame — stop threshold
const TICK_COUNT = 60; // visual tick marks
const TICK_SPACING = 12; // px between ticks

/* ─── Component ───────────────────────────────────────────────────────────── */

export function JogWheel({
  currentTime,
  duration,
  onSeek,
  sensitivity = 0.02,
  fps,
  videoRef,
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
  /** Visual offset for tick strip (imperative, not React state in fast path) */
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [active, setActive] = useState(false);

  // Keep timeRef in sync with prop when not dragging
  useEffect(() => {
    if (!isDragging.current) {
      timeRef.current = currentTime;
    }
  }, [currentTime]);

  /** Whether to use direct DOM mutation (zero-jitter fast path) */
  const useDirectDOM = !!videoRef;

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

      // Directly mutate tick strip transform — zero React overhead
      if (tickStripRef.current) {
        const timeOffset =
          duration > 0
            ? (clamped / duration) * TICK_COUNT * TICK_SPACING
            : 0;
        tickStripRef.current.style.transform = `translateX(${
          -timeOffset + offsetRef.current * 0.05
        }px)`;
        tickStripRef.current.style.transition = "none";
      }
    },
    [duration, fps, videoRef]
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
      if (useDirectDOM) {
        seekDirect(delta);
      } else {
        seekViaCallback(delta);
      }
    },
    [useDirectDOM, seekDirect, seekViaCallback]
  );

  /* ── Sync React state after momentum settles (direct DOM only) ─────── */

  const syncReactState = useCallback(() => {
    if (useDirectDOM) {
      onSeek(timeRef.current);
    }
  }, [useDirectDOM, onSeek]);

  /* ── Momentum animation loop ───────────────────────────────────────── */

  const animateMomentum = useCallback(() => {
    if (Math.abs(velocityRef.current) < MIN_VELOCITY) {
      velocityRef.current = 0;
      // Momentum settled — sync React state once
      syncReactState();
      return;
    }

    // Convert pixel velocity to time delta
    const timeDelta = velocityRef.current * sensitivity;
    seek(timeDelta);

    // Apply friction
    velocityRef.current *= FRICTION;

    // Visual offset
    if (useDirectDOM) {
      offsetRef.current += velocityRef.current;
    } else {
      setOffset((prev) => prev + velocityRef.current);
    }

    rafRef.current = requestAnimationFrame(animateMomentum);
  }, [seek, sensitivity, syncReactState, useDirectDOM]);

  /* ── Pointer start ─────────────────────────────────────────────────── */

  const handleStart = useCallback(
    (clientX: number) => {
      isDragging.current = true;
      lastX.current = clientX;
      velocityRef.current = 0;
      velocitySamples.current = [];
      lastMoveTime.current = performance.now();
      timeRef.current = useDirectDOM
        ? videoRef?.current?.currentTime ?? currentTime
        : currentTime;
      setActive(true);

      // Cancel any existing momentum animation
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [currentTime, useDirectDOM, videoRef]
  );

  /* ── Pointer move ──────────────────────────────────────────────────── */

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDragging.current) return;

      const dx = clientX - lastX.current;
      const now = performance.now();
      const dt = now - lastMoveTime.current;

      lastX.current = clientX;
      lastMoveTime.current = now;

      // Track velocity samples (keep last 5)
      velocitySamples.current.push({ dx, dt });
      if (velocitySamples.current.length > 5) velocitySamples.current.shift();

      // Seek the video
      const timeDelta = dx * sensitivity;
      seek(timeDelta);

      // Visual offset
      if (useDirectDOM) {
        offsetRef.current += dx;
      } else {
        setOffset((prev) => prev + dx);
      }
    },
    [seek, sensitivity, useDirectDOM]
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

  // Calculate visual offset based on time position
  const timeOffset =
    duration > 0 ? (currentTime / duration) * TICK_COUNT * TICK_SPACING : 0;

  return (
    <div
      ref={containerRef}
      className={`relative h-10 overflow-hidden select-none touch-none ${className ?? ""}`}
      style={{ cursor: active ? "grabbing" : "grab" }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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
