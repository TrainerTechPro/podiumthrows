"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export interface StaggeredListProps {
  children: ReactNode;
  /** Delay between each child in ms (default 50) */
  staggerDelay?: number;
  /** Animation duration per child in ms (default 250) */
  duration?: number;
  className?: string;
}

/**
 * Wraps a list/grid of children and animates them in with staggered
 * fade-in + slide-up on first viewport entry.
 *
 * Applies animation styles directly to each child via cloneElement,
 * so grid/flex layouts are preserved (no wrapper divs inserted).
 *
 * Respects `prefers-reduced-motion` — renders immediately without animation.
 */
export function StaggeredList({
  children,
  staggerDelay = 50,
  duration = 250,
  className,
}: StaggeredListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const hasTriggered = useRef(false);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reducedMotion.current) {
      setVisible(true);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTriggered.current) {
          hasTriggered.current = true;
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const skip = reducedMotion.current;

  return (
    <div ref={containerRef} className={cn(className)}>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;

        if (skip) return child;

        const delay = i * staggerDelay;

        const animStyle: React.CSSProperties = visible
          ? {
              opacity: 1,
              transform: "translateY(0)",
              transition: `opacity ${duration}ms ease-out ${delay}ms, transform ${duration}ms ease-out ${delay}ms`,
            }
          : {
              opacity: 0,
              transform: "translateY(12px)",
            };

        const merged: React.CSSProperties = {
          ...((child.props as Record<string, unknown>).style as React.CSSProperties | undefined),
          ...animStyle,
        };

        return cloneElement(child as React.ReactElement<{ style?: React.CSSProperties }>, {
          style: merged,
        });
      })}
    </div>
  );
}
