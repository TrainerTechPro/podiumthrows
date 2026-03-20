"use client";

import { useEffect, useRef, useState, useCallback, type RefObject } from "react";

export interface AnimatedCounterOptions {
  /** Number of decimal places (default: 0) */
  decimals?: number;
  /** Unit suffix — not part of the animated value, just for convenience */
  unit?: string;
  /** Easing: ease-out deceleration (default) */
  easing?: (t: number) => number;
  /** If true, skips animation entirely (useful for SSR hydration safety) */
  disabled?: boolean;
}

/** Default ease-out: decelerates naturally */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates a numeric value from its previous value to the target.
 * Only starts counting when the element enters the viewport.
 *
 * @param target    The target number to count toward
 * @param duration  Animation duration in ms (default 1200)
 * @param options   Decimal places, unit, easing, disabled
 * @returns `{ value, formatted, ref }` — attach `ref` to the container element
 */
export function useAnimatedCounter(
  target: number,
  duration = 1200,
  options: AnimatedCounterOptions = {}
): {
  value: number;
  formatted: string;
  ref: RefObject<HTMLElement | null>;
} {
  const { decimals = 0, unit = "", easing = easeOutCubic, disabled = false } = options;

  const containerRef = useRef<HTMLElement | null>(null);
  const prevTarget = useRef(0);
  const rafId = useRef(0);
  const hasAnimated = useRef(false);

  // Check reduced motion preference
  const prefersReducedMotion = useRef(false);
  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const [current, setCurrent] = useState(0);

  const animate = useCallback(
    (from: number, to: number) => {
      if (prefersReducedMotion.current || disabled) {
        setCurrent(to);
        return;
      }

      const start = performance.now();
      cancelAnimationFrame(rafId.current);

      function tick(now: number) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easing(progress);
        const val = from + (to - from) * easedProgress;

        setCurrent(val);

        if (progress < 1) {
          rafId.current = requestAnimationFrame(tick);
        }
      }

      rafId.current = requestAnimationFrame(tick);
    },
    [duration, easing, disabled]
  );

  // Intersection Observer — trigger animation on viewport entry
  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) {
      setCurrent(target);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          animate(0, target);
          prevTarget.current = target;
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId.current);
    };
  }, [target, animate, disabled]);

  // Re-animate when target changes after initial animation
  useEffect(() => {
    if (!hasAnimated.current) return;
    if (target === prevTarget.current) return;

    animate(prevTarget.current, target);
    prevTarget.current = target;
  }, [target, animate]);

  const formatted =
    current.toFixed(decimals) + (unit ? unit : "");

  return {
    value: Number(current.toFixed(decimals)),
    formatted,
    ref: containerRef,
  };
}
