"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface InlineRestTimerProps {
  seconds: number;
  onComplete: () => void;
  autoStart?: boolean;
}

/**
 * Inline rest timer with circular progress ring.
 * Uses Date.now() delta-based timing to survive iOS screen lock.
 * Auto-starts on mount when autoStart=true.
 */
export function InlineRestTimer({
  seconds,
  onComplete,
  autoStart = true,
}: InlineRestTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [isRunning, setIsRunning] = useState(false);
  const startTimeRef = useRef<number>(0);
  const totalRef = useRef(seconds);
  const rafRef = useRef<number>(0);
  const completedRef = useRef(false);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsRunning(false);
    setRemaining(0);

    // Haptic feedback on iOS
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(200);
    }

    onComplete();
  }, [onComplete]);

  const tick = useCallback(() => {
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const left = Math.max(0, totalRef.current - elapsed);

    if (left <= 0) {
      finish();
      return;
    }

    setRemaining(left);
    rafRef.current = requestAnimationFrame(tick);
  }, [finish]);

  const start = useCallback(() => {
    completedRef.current = false;
    startTimeRef.current = Date.now();
    totalRef.current = seconds;
    setIsRunning(true);
    setRemaining(seconds);
    rafRef.current = requestAnimationFrame(tick);
  }, [seconds, tick]);

  // Auto-start on mount
  useEffect(() => {
    if (autoStart) {
      start();
    }
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function skip() {
    cancelAnimationFrame(rafRef.current);
    finish();
  }

  // SVG ring math
  const size = 80;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds > 0 ? ((seconds - remaining) / seconds) * 100 : 0;
  const dashOffset = circumference - (progress / 100) * circumference;

  const displaySeconds = Math.ceil(remaining);
  const mins = Math.floor(displaySeconds / 60);
  const secs = displaySeconds % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;
  const isLow = displaySeconds <= 5 && displaySeconds > 0;

  if (!isRunning && remaining <= 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center py-4 animate-fade-in">
      {/* Circular progress */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className={`transition-[stroke-dashoffset] duration-200 ${
              isLow ? "text-red-500" : "text-primary-500"
            }`}
          />
        </svg>
        {/* Time display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`text-lg font-bold tabular-nums ${
              isLow ? "text-red-500 animate-subtle-pulse" : "text-gray-900 dark:text-white"
            }`}
          >
            {timeStr}
          </span>
        </div>
      </div>

      {/* Label + skip */}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Rest</p>
      <button
        type="button"
        onClick={skip}
        className="mt-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors min-h-[44px] px-4 flex items-center"
      >
        Skip Rest
      </button>
    </div>
  );
}
