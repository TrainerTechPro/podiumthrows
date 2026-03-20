import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const variants: Record<BadgeVariant, string> = {
  primary: "bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300",
  success: "bg-success-50 dark:bg-success-500/15 text-success-700 dark:text-success-500",
  warning: "bg-warning-50 dark:bg-warning-500/15 text-warning-700 dark:text-warning-500",
  danger: "bg-danger-50 dark:bg-danger-500/15 text-danger-700 dark:text-danger-500 animate-danger-pulse",
  info: "bg-info-50 dark:bg-info-500/15 text-info-700 dark:text-info-500",
  neutral: "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300",
};

const dotColors: Record<BadgeVariant, string> = {
  primary: "bg-primary-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  info: "bg-info-500",
  neutral: "bg-surface-400",
};

export function Badge({ variant = "neutral", dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColors[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
