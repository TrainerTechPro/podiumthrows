"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { NumberFlow } from "./NumberFlow";

export interface RestTimerProps {
  /** Duration in seconds */
  seconds: number;
  /** Auto-start on mount */
  autoStart?: boolean;
  /** Called when timer reaches 0 */
  onComplete?: () => void;
  /** Compact mode for inline use */
  compact?: boolean;
  className?: string;
}

export function RestTimer({
  seconds,
  autoStart = false,
  onComplete,
  compact = false,
  className,
}: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    completedRef.current = false;
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    setRunning(false);
    clearTimer();
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setRunning(false);
    setRemaining(seconds);
    completedRef.current = false;
  }, [seconds, clearTimer]);

  useEffect(() => {
    if (!running) return;

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearTimer();
          setRunning(false);
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete?.();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [running, clearTimer, onComplete]);

  // Reset remaining when seconds prop changes
  useEffect(() => {
    setRemaining(seconds);
    setRunning(autoStart);
    completedRef.current = false;
  }, [seconds, autoStart]);

  const progress = seconds > 0 ? remaining / seconds : 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;
  const done = remaining === 0 && !running;

  if (compact) {
    return (
      <div className={cn("inline-flex items-center gap-2", className)}>
        <span
          className={cn(
            "tabular-nums font-bold text-sm",
            done
              ? "text-emerald-600 dark:text-emerald-400"
              : running
                ? "text-primary-600 dark:text-primary-400"
                : "text-muted"
          )}
        >
          {timeStr}
        </span>
        {!done && (
          <button
            onClick={running ? pause : start}
            aria-label={running ? "Pause rest timer" : remaining < seconds ? "Resume rest timer" : "Start rest timer"}
            className="text-xs text-primary-500 hover:underline"
          >
            {running ? "Pause" : remaining < seconds ? "Resume" : "Start"}
          </button>
        )}
        {(running || remaining < seconds) && !done && (
          <button onClick={reset} aria-label="Reset rest timer" className="text-xs text-muted hover:underline">
            Reset
          </button>
        )}
        {done && (
          <button onClick={reset} aria-label="Restart rest timer" className="text-xs text-primary-500 hover:underline">
            Restart
          </button>
        )}
      </div>
    );
  }

  // Full mode — circular progress
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Circular Timer */}
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-surface-200 dark:text-surface-700"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(
              "transition-[stroke-dashoffset] duration-1000 ease-linear",
              done
                ? "text-emerald-500"
                : "text-primary-500"
            )}
          />
        </svg>
        {/* Time display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "text-2xl font-bold",
              done
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-[var(--foreground)]"
            )}
          >
            <NumberFlow value={remaining} duration={300} />
            <span className="text-base font-medium text-muted ml-0.5">s</span>
          </span>
          {done && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Done
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {!done ? (
          <>
            <button
              onClick={running ? pause : start}
              aria-label={running ? "Pause rest timer" : remaining < seconds ? "Resume rest timer" : "Start rest timer"}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                running
                  ? "bg-surface-200 dark:bg-surface-700 text-[var(--foreground)] hover:bg-surface-300 dark:hover:bg-surface-600"
                  : "bg-primary-500 text-white hover:bg-primary-600"
              )}
            >
              {running ? "Pause" : remaining < seconds ? "Resume" : "Start"}
            </button>
            {(running || remaining < seconds) && (
              <button
                onClick={reset}
                aria-label="Reset rest timer"
                className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                Reset
              </button>
            )}
          </>
        ) : (
          <button
            onClick={reset}
            aria-label="Restart rest timer"
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors"
          >
            Restart
          </button>
        )}
      </div>
    </div>
  );
}
