import { HTMLAttributes } from "react";
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
  /** Animate fill on mount */
  animate?: boolean;
}

const trackHeight = { sm: "h-1.5", md: "h-2.5", lg: "h-4" };

const fillColors: Record<ProgressVariant, string> = {
  primary: "bg-primary-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger:  "bg-danger-500",
  info:    "bg-info-500",
};

const trackColors: Record<ProgressVariant, string> = {
  primary: "bg-primary-100  dark:bg-primary-500/20",
  success: "bg-success-50   dark:bg-success-500/20",
  warning: "bg-warning-50   dark:bg-warning-500/20",
  danger:  "bg-danger-50    dark:bg-danger-500/20",
  info:    "bg-info-50      dark:bg-info-500/20",
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
        className={cn("w-full rounded-full overflow-hidden", trackHeight[size], trackColors[variant])}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={title ?? displayLabel}
      >
        <div
          className={cn(
            "h-full rounded-full",
            fillColors[variant],
            animate && "transition-[width] duration-700 ease-out"
          )}
          style={{ width: `${clamped}%` }}
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

export function SegmentedProgressBar({ segments, size = "md", className }: SegmentedProgressBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className={cn("flex w-full rounded-full overflow-hidden gap-0.5", trackHeight[size], className)}>
      {segments.map((seg, i) => (
        <div
          key={i}
          className={cn("h-full transition-[width] duration-700 ease-out first:rounded-l-full last:rounded-r-full", fillColors[seg.variant])}
          style={{ width: `${(seg.value / total) * 100}%` }}
          title={seg.label}
          role="presentation"
        />
      ))}
    </div>
  );
}
