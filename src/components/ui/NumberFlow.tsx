"use client";

import { useEffect, useRef, useState } from "react";

export interface NumberFlowProps {
  /** The current target value */
  value: number;
  /** Number of decimal places (default 0) */
  decimals?: number;
  /** Suffix after the number (e.g. "kg", "m", "%") */
  suffix?: string;
  /** Prefix before the number (e.g. "$") */
  prefix?: string;
  /** Transition duration in ms (default 400) */
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Smoothly animates between number values on every change.
 * Uses requestAnimationFrame with ease-out easing.
 * Respects `prefers-reduced-motion`.
 */
export function NumberFlow({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  duration = 400,
  className,
  style,
}: NumberFlowProps) {
  const [display, setDisplay] = useState(value);
  const rafId = useRef(0);
  const prevValue = useRef(value);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    prevValue.current = value;

    if (from === to) return;

    if (reducedMotion.current || duration <= 0) {
      setDisplay(to);
      return;
    }

    cancelAnimationFrame(rafId.current);
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      setDisplay(from + (to - from) * eased);

      if (progress < 1) {
        rafId.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
      }
    }

    rafId.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId.current);
  }, [value, duration]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
