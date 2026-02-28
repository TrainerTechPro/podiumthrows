import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export type TrendDirection = "up" | "down" | "flat";

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: ReactNode;
  /** e.g. "m", "kg", "%" */
  unit?: string;
  trend?: {
    direction: TrendDirection;
    value: string;
    /** Whether "up" is good or bad — affects color. Defaults to true (up = good). */
    positiveIsUp?: boolean;
  };
  icon?: ReactNode;
  /** Subtle colored accent on the left edge */
  accent?: "primary" | "success" | "warning" | "danger" | "none";
  /** Additional note below the value */
  note?: string;
}

const accentColors = {
  primary: "border-l-primary-500",
  success: "border-l-success-500",
  warning: "border-l-warning-500",
  danger:  "border-l-danger-500",
  none:    "",
};

function TrendArrow({ direction }: { direction: TrendDirection }) {
  const Icon = direction === "flat" ? Minus : direction === "up" ? TrendingUp : TrendingDown;
  return <Icon size={14} strokeWidth={2.5} aria-hidden="true" />;
}

function getTrendColor(direction: TrendDirection, positiveIsUp: boolean): string {
  if (direction === "flat") return "text-surface-400 dark:text-surface-500";
  const isPositive = (direction === "up") === positiveIsUp;
  return isPositive
    ? "text-success-600 dark:text-success-400"
    : "text-danger-500 dark:text-danger-400";
}

export function StatCard({
  label,
  value,
  unit,
  trend,
  icon,
  accent = "none",
  note,
  className,
  ...props
}: StatCardProps) {
  const hasAccent = accent !== "none";

  return (
    <div
      className={cn(
        "card p-5",
        hasAccent && "border-l-4",
        hasAccent && accentColors[accent],
        className
      )}
      {...props}
    >
      {/* Label row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
        {icon && (
          <span className="text-surface-400 dark:text-surface-500 shrink-0">{icon}</span>
        )}
      </div>

      {/* Value row */}
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-bold font-heading text-[var(--foreground)] leading-none tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-base font-medium text-muted mb-0.5">{unit}</span>
        )}
      </div>

      {/* Trend + note */}
      {(trend || note) && (
        <div className="mt-3 flex items-center justify-between gap-2">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                getTrendColor(trend.direction, trend.positiveIsUp ?? true)
              )}
            >
              <TrendArrow direction={trend.direction} />
              {trend.value}
            </span>
          )}
          {note && (
            <p className="text-xs text-muted truncate">{note}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Mini stat (inline, no card frame) ─────────────────────────────────── */

export interface MiniStatProps {
  label: string;
  value: ReactNode;
  unit?: string;
  className?: string;
}

export function MiniStat({ label, value, unit, className }: MiniStatProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="text-lg font-bold font-heading text-[var(--foreground)] tabular-nums leading-tight">
        {value}
        {unit && <span className="text-sm font-medium text-muted ml-1">{unit}</span>}
      </p>
    </div>
  );
}
