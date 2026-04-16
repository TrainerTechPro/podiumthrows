"use client";

import { HTMLAttributes, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ProgressVariant = "primary" | "success" | "warning" | "danger" | "info";

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–100 */
  value: number;
  variant?: ProgressVariant;
  /** Show percentage label on the right */
  showLabel?: boolean;
  /** Custom label (overrides percentage) */
  label?: string;
  /** Display above the bar */
  title?: string;
  size?: "sm" | "md" | "lg";
  /** Animate fill on mount (default true). Set false for instant render. */
  animate?: boolean;
}

const trackHeight = { sm: "h-1.5", md: "h-2.5", lg: "h-4" };

const fillColors: Record<ProgressVariant, string> = {
  primary: "bg-primary-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  info: "bg-info-500",
};

/* Track always sits on the base surface; neomorphic inset shadow gives
   the carved-in feel, so we keep a single neutral background for all
   variants and let the fill (with its glow) carry the color identity. */
const trackBase = "bg-[var(--card-bg)] neo-inset-sm";

const fillGlow: Record<ProgressVariant, string> = {
  primary: "shadow-[0_0_10px_rgba(255,200,0,0.45)]",
  success: "shadow-[0_0_10px_rgba(0,255,136,0.35)]",
  warning: "shadow-[0_0_10px_rgba(255,136,0,0.35)]",
  danger: "shadow-[0_0_10px_rgba(255,34,34,0.35)]",
  info: "shadow-[0_0_10px_rgba(68,136,255,0.35)]",
};

/** Auto-picks variant based on score (used for readiness / RPE displays) */
export function variantFromScore(score: number): ProgressVariant {
  if (score >= 80) return "success";
  if (score >= 60) return "primary";
  if (score >= 40) return "warning";
  return "danger";
}

export function ProgressBar({
  value,
  variant = "primary",
  showLabel = false,
  label,
  title,
  size = "md",
  animate = true,
  className,
  ...props
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const displayLabel = label ?? `${Math.round(clamped)}%`;

  const trackRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(!animate);
  const [shimmer, setShimmer] = useState(false);
  const hasEntered = useRef(!animate);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!animate || reducedMotion.current) {
      setRendered(true);
      return;
    }

    const el = trackRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasEntered.current) {
          hasEntered.current = true;
          // Start from 0, then animate to target
          setRendered(true);
          setShimmer(true);
          // Remove shimmer after animation completes
          setTimeout(() => setShimmer(false), 900);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [animate]);

  // After first entrance, value changes animate with 300ms
  const isPostEntrance = hasEntered.current && rendered;
  const skip = reducedMotion.current || !animate;

  const fillWidth = rendered ? clamped : 0;

  const transitionStyle = skip
    ? undefined
    : isPostEntrance && !shimmer
      ? "width 300ms ease-out"
      : "width 800ms ease-out";

  return (
    <div className={cn("w-full", className)} {...props}>
      {(title || showLabel) && (
        <div className="flex items-center justify-between mb-1.5 gap-2">
          {title && (
            <span className="text-sm font-medium text-[var(--foreground)] truncate">{title}</span>
          )}
          {showLabel && (
            <span className="text-xs tabular-nums font-medium text-muted shrink-0">
              {displayLabel}
            </span>
          )}
        </div>
      )}

      <div
        ref={trackRef}
        className={cn("w-full rounded-full overflow-hidden", trackHeight[size], trackBase)}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={title ?? displayLabel}
      >
        <div
          className={cn(
            "h-full rounded-full relative",
            fillColors[variant],
            fillGlow[variant],
            shimmer && "progress-shimmer"
          )}
          style={{
            width: `${fillWidth}%`,
            transition: transitionStyle,
          }}
        />
      </div>
    </div>
  );
}

/* ─── Multi-segment bar (for sleep / energy breakdowns) ─────────────────── */

export interface ProgressSegment {
  value: number;
  variant: ProgressVariant;
  label?: string;
}

export interface SegmentedProgressBarProps {
  segments: ProgressSegment[];
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function SegmentedProgressBar({
  segments,
  size = "md",
  className,
}: SegmentedProgressBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div
      className={cn(
        "flex w-full rounded-full overflow-hidden gap-0.5 neo-inset-sm",
        trackHeight[size],
        className
      )}
    >
      {segments.map((seg, i) => (
        <div
          key={i}
          className={cn(
            "h-full transition-[width] duration-700 ease-out first:rounded-l-full last:rounded-r-full",
            fillColors[seg.variant],
            fillGlow[seg.variant]
          )}
          style={{ width: `${(seg.value / total) * 100}%` }}
          title={seg.label}
          role="presentation"
        />
      ))}
    </div>
  );
}
