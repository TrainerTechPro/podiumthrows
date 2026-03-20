"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SlideToConfirmProps {
  /** Text shown in the track (e.g. "Slide to Complete Session") */
  label: string;
  /** Triggered when the thumb reaches the completion threshold */
  onConfirm: () => void;
  /** Disable interaction */
  disabled?: boolean;
  /** 'confirm' = amber/gold, 'destructive' = red */
  variant?: "confirm" | "destructive";
  className?: string;
}

const COMPLETION_THRESHOLD = 0.85;

export function SlideToConfirm({
  label,
  onConfirm,
  disabled = false,
  variant = "confirm",
  className,
}: SlideToConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [springing, setSpringing] = useState(false);
  const startXRef = useRef(0);
  const trackWidthRef = useRef(0);
  const confirmedRef = useRef(false);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  const thumbSize = 52;

  const getMaxTravel = useCallback(() => {
    const track = trackRef.current;
    if (!track) return 200;
    return track.offsetWidth - thumbSize - 8; // 8 = padding
  }, []);

  const handleStart = useCallback(
    (clientX: number) => {
      if (disabled || completed) return;
      const track = trackRef.current;
      if (!track) return;
      trackWidthRef.current = getMaxTravel();
      startXRef.current = clientX;
      setDragging(true);
      setSpringing(false);
    },
    [disabled, completed, getMaxTravel]
  );

  const handleMove = useCallback(
    (clientX: number) => {
      if (!dragging || disabled || completed) return;
      const delta = clientX - startXRef.current;
      const maxTravel = trackWidthRef.current;
      const pct = Math.max(0, Math.min(1, delta / maxTravel));
      setProgress(pct);
    },
    [dragging, disabled, completed]
  );

  const handleEnd = useCallback(() => {
    if (!dragging || disabled) return;
    setDragging(false);

    if (progress >= COMPLETION_THRESHOLD && !confirmedRef.current) {
      confirmedRef.current = true;
      setProgress(1);
      setCompleted(true);
      onConfirm();
    } else if (!completed) {
      // Spring back
      setSpringing(true);
      setProgress(0);
    }
  }, [dragging, disabled, progress, completed, onConfirm]);

  // Mouse events
  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => handleEnd();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, handleMove, handleEnd]);

  // Reset completed state when disabled changes (allows reuse)
  useEffect(() => {
    if (disabled) {
      setCompleted(false);
      setProgress(0);
      confirmedRef.current = false;
    }
  }, [disabled]);

  const isConfirm = variant === "confirm";
  const maxTravel = getMaxTravel();
  const thumbX = progress * maxTravel;
  const labelOpacity = 1 - progress * 1.5; // Fades out by ~67%

  const transitionStyle =
    !dragging && (springing || completed)
      ? reducedMotion.current
        ? "none"
        : completed
          ? "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)"
          : "transform 400ms cubic-bezier(0.4, 0, 0.2, 1)"
      : "none";

  return (
    <div
      ref={trackRef}
      className={cn(
        "relative h-[60px] rounded-full select-none overflow-hidden",
        "border",
        isConfirm
          ? "bg-primary-50 dark:bg-primary-950/30 border-primary-200 dark:border-primary-800/50"
          : "bg-danger-50 dark:bg-danger-500/5 border-danger-500/20 dark:border-danger-500/15",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      aria-label={label}
      role="slider"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Fill bar */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full",
          isConfirm
            ? "bg-primary-500/15 dark:bg-primary-500/20"
            : "bg-danger-500/15 dark:bg-danger-500/20"
        )}
        style={{ width: `${progress * 100}%` }}
      />

      {/* Label text */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ opacity: Math.max(0, labelOpacity) }}
      >
        <span
          className={cn(
            "text-sm font-semibold font-heading tracking-wide",
            isConfirm
              ? "text-primary-700 dark:text-primary-400"
              : "text-danger-600 dark:text-danger-400"
          )}
        >
          {label}
        </span>
      </div>

      {/* Chevrons hint */}
      <div
        className="absolute inset-y-0 right-4 flex items-center pointer-events-none"
        style={{ opacity: Math.max(0, 1 - progress * 2) }}
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
          className={cn(
            isConfirm
              ? "text-primary-300 dark:text-primary-700"
              : "text-danger-300 dark:text-danger-700"
          )}
          aria-hidden="true"
        >
          <polyline points="7 18 13 12 7 6" />
          <polyline points="13 18 19 12 13 6" />
        </svg>
      </div>

      {/* Thumb */}
      <div
        ref={thumbRef}
        className={cn(
          "absolute top-1 left-1 rounded-full flex items-center justify-center",
          "shadow-md active:shadow-lg",
          !disabled && "cursor-grab active:cursor-grabbing",
          isConfirm
            ? "bg-primary-500"
            : "bg-danger-500"
        )}
        style={{
          width: thumbSize,
          height: thumbSize,
          transform: `translateX(${thumbX}px)`,
          transition: transitionStyle,
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          handleStart(e.clientX);
        }}
        onTouchStart={(e) => {
          handleStart(e.touches[0].clientX);
        }}
        onTouchMove={(e) => {
          handleMove(e.touches[0].clientX);
        }}
        onTouchEnd={handleEnd}
      >
        {completed ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </div>
    </div>
  );
}
