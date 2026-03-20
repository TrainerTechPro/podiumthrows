"use client";

import { useAnimatedCounter, type AnimatedCounterOptions } from "@/lib/hooks/useAnimatedCounter";

export interface AnimatedNumberProps extends AnimatedCounterOptions {
  value: number;
  /** Animation duration in ms (default 1200) */
  duration?: number;
  className?: string;
}

/**
 * Drop-in replacement for rendering a numeric value with count-up animation.
 * Attach to viewport via Intersection Observer — only animates when visible.
 * Respects `prefers-reduced-motion`.
 */
export function AnimatedNumber({
  value,
  duration = 1200,
  decimals = 0,
  unit,
  className,
  ...rest
}: AnimatedNumberProps) {
  const counter = useAnimatedCounter(value, duration, { decimals, unit, ...rest });

  return (
    <span ref={counter.ref as React.RefObject<HTMLSpanElement>} className={className}>
      {counter.value.toFixed(decimals)}
    </span>
  );
}
