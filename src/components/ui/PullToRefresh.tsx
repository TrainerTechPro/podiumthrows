"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";

/**
 * Pull-to-refresh primitive for athlete pages.
 *
 * Wraps a scroll container (defaults to its own DOM parent if not given).
 * Drag-down is only honored when the scroll container is at the top —
 * scrolling within content never fights the gesture. Touch-only by design;
 * desktop has F5 / ⌘R.
 *
 * Behavior:
 *   - Threshold 60px (commits the refresh on release)
 *   - Resistance curve: pull * 0.5, capped at 120px
 *   - Indicator (amber RefreshCw) rotates with pull progress (0–270°)
 *   - On commit: indicator spins, await onRefresh(), `haptic.light()` fires
 *   - prefers-reduced-motion: instant snap-back, no rotation transitions
 *   - Uses CSS transform; never mutates scroll position
 */

export interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | unknown;
  /**
   * Pull-down threshold in px before a release commits a refresh. Default 60.
   */
  threshold?: number;
  /** Disable the gesture entirely (e.g. focus-mode pages). */
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

const DEFAULT_THRESHOLD = 60;
const MAX_PULL = 120;
const RESISTANCE = 0.5;
const SPINNER_PEEK_PX = 50; // visible offset while refreshing

function getReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function findScrollParent(start: HTMLElement | null): HTMLElement | Window {
  if (typeof window === "undefined" || !start) return window;
  let el: HTMLElement | null = start.parentElement;
  while (el) {
    const cs = window.getComputedStyle(el);
    const oy = cs.overflowY;
    if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  return window;
}

function getScrollTop(target: HTMLElement | Window): number {
  if (target === window) {
    return typeof window === "undefined" ? 0 : window.scrollY;
  }
  return (target as HTMLElement).scrollTop;
}

export function PullToRefresh({
  onRefresh,
  threshold = DEFAULT_THRESHOLD,
  disabled = false,
  children,
  className,
}: PullToRefreshProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [animating, setAnimating] = useState(false);
  const startY = useRef<number | null>(null);
  const tracking = useRef(false);
  const scrollParent = useRef<HTMLElement | Window | null>(null);
  const haptic = useHaptic();

  // Resolve the scroll container once on mount.
  useEffect(() => {
    scrollParent.current = findScrollParent(wrapperRef.current);
  }, []);

  const reset = useCallback(() => {
    const reduced = getReducedMotion();
    setAnimating(!reduced);
    setPullDistance(0);
    if (reduced) {
      // Animation skipped — clear the animating flag immediately.
      setAnimating(false);
      return;
    }
    // Match the CSS transition duration below.
    window.setTimeout(() => setAnimating(false), 220);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (disabled || refreshing) return;
      const target = scrollParent.current ?? window;
      if (getScrollTop(target) > 0) return;
      startY.current = e.touches[0].clientY;
      tracking.current = true;
      setAnimating(false);
    },
    [disabled, refreshing]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!tracking.current || startY.current === null) return;
      const target = scrollParent.current ?? window;
      // If the user scrolled the container while tracking (e.g. a nested
      // momentum scroll started), bail.
      if (getScrollTop(target) > 0) {
        tracking.current = false;
        setPullDistance(0);
        return;
      }
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        if (pullDistance !== 0) setPullDistance(0);
        return;
      }
      const eased = Math.min(MAX_PULL, delta * RESISTANCE);
      setPullDistance(eased);
    },
    [pullDistance]
  );

  const onTouchEnd = useCallback(async () => {
    if (!tracking.current) return;
    tracking.current = false;
    if (pullDistance < threshold) {
      reset();
      return;
    }
    // Commit refresh.
    setRefreshing(true);
    setAnimating(true);
    setPullDistance(SPINNER_PEEK_PX);
    try {
      await onRefresh();
    } finally {
      haptic.light();
      setRefreshing(false);
      reset();
    }
  }, [pullDistance, threshold, onRefresh, reset, haptic]);

  // Indicator visual state.
  const progress = Math.min(1, pullDistance / threshold);
  const rotation = refreshing ? 0 : Math.round(progress * 270);
  const showIndicator = pullDistance > 0 || refreshing;
  // Indicator opacity ramps in over the first 30% of pull, hits 1 at threshold.
  const indicatorOpacity = refreshing ? 1 : Math.min(1, Math.max(0, progress * 1.4 - 0.1));

  const transformTransition = animating ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)" : "none";

  return (
    <div
      ref={wrapperRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        if (tracking.current) {
          tracking.current = false;
          if (!refreshing) reset();
        }
      }}
      className={className}
      style={{
        position: "relative",
        transform: `translate3d(0, ${pullDistance}px, 0)`,
        transition: transformTransition,
        // Keep iOS native overscroll bounce out of the way.
        overscrollBehaviorY: "contain",
      }}
    >
      {/* Indicator floats at the top edge, translated up by its own height
          so it only enters the viewport during a pull. */}
      {showIndicator && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -36,
            left: "50%",
            transform: `translate3d(-50%, 0, 0)`,
            opacity: indicatorOpacity,
            transition: animating ? "opacity 200ms ease-out" : "none",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <div
            className={`rounded-full bg-primary-500/15 border border-primary-500/40 p-2 ${
              refreshing ? "animate-spin" : ""
            }`}
            style={
              refreshing
                ? undefined
                : {
                    transform: `rotate(${rotation}deg)`,
                    transition: animating
                      ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)"
                      : "none",
                  }
            }
          >
            <RefreshCw
              className="text-primary-500"
              size={16}
              strokeWidth={2.25}
              aria-hidden="true"
            />
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
