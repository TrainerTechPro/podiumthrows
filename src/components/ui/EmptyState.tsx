import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Users, Calendar, Search, AlertCircle, RefreshCw } from "lucide-react";

export interface EmptyStateSuggestion {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  /** Icon or illustration */
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Suggestion chips shown below description */
  suggestions?: EmptyStateSuggestion[];
  className?: string;
  /** Compact layout for tables / small containers */
  compact?: boolean;
  /**
   * "default" — neutral empty.
   * "error"   — failed-to-load surface; tints the icon danger and styles
   *             the built-in retry button. When `onRetry` is supplied we
   *             render the button automatically; pass `action` to override.
   */
  tone?: "default" | "error";
  /** Built-in retry handler — only shown when tone='error'. */
  onRetry?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  suggestions,
  className,
  compact = false,
  tone = "default",
  onRetry,
}: EmptyStateProps) {
  const isError = tone === "error";
  const resolvedIcon =
    icon ??
    (isError ? (
      <AlertCircle size={compact ? 24 : 48} strokeWidth={1.75} aria-hidden="true" />
    ) : null);
  const resolvedAction =
    action ??
    (isError && onRetry ? (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-danger-700 dark:text-danger-300 bg-danger-50 dark:bg-danger-500/15 hover:bg-danger-100 dark:hover:bg-danger-500/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-500/50"
      >
        <RefreshCw size={12} strokeWidth={2.25} aria-hidden="true" />
        Try again
      </button>
    ) : undefined);

  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "py-8 px-4 gap-2" : "py-16 px-6 gap-4",
        className
      )}
    >
      {resolvedIcon && (
        <div
          className={cn(
            "shrink-0",
            isError
              ? "text-danger-500 dark:text-danger-400"
              : "text-surface-300 dark:text-surface-600",
            compact ? "[&_svg]:w-6 [&_svg]:h-6" : "[&_svg]:w-12 [&_svg]:h-12"
          )}
        >
          {resolvedIcon}
        </div>
      )}

      <div className={cn("max-w-xs", compact && "max-w-[220px]")}>
        <h3
          className={cn(
            "font-semibold text-[var(--foreground)]",
            compact ? "text-sm" : "text-base"
          )}
        >
          {title}
        </h3>
        {description && (
          <p className={cn("text-muted mt-1 leading-relaxed", compact ? "text-xs" : "text-sm")}>
            {description}
          </p>
        )}
      </div>

      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          {suggestions.map((s, i) => (
            <button
              key={s.label}
              onClick={s.onClick}
              className={cn(
                "bg-surface-100 dark:bg-surface-800 hover:bg-primary-50 dark:hover:bg-primary-500/10",
                "text-sm text-[var(--foreground)] rounded-full px-3 py-1.5",
                "border border-surface-200 dark:border-surface-700",
                "hover:border-primary-300 dark:hover:border-primary-500/30",
                "transition-all duration-150",
                "animate-chip-in"
              )}
              style={{ animationDelay: `${i * 75}ms` }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {resolvedAction && <div className={cn(compact ? "mt-1" : "mt-2")}>{resolvedAction}</div>}
    </div>
  );
}

/* ─── Pre-built themed empties ───────────────────────────────────────────── */

export function NoAthletesEmpty({ onInvite }: { onInvite?: () => void }) {
  return (
    <EmptyState
      icon={<Users size={24} strokeWidth={1.75} aria-hidden="true" />}
      title="No athletes yet"
      description="Invite your first athlete to get started. They'll appear here once they accept."
      action={
        onInvite && (
          <button className="btn-primary" onClick={onInvite}>
            Invite Athlete
          </button>
        )
      }
    />
  );
}

export function NoSessionsEmpty({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<Calendar size={24} strokeWidth={1.75} aria-hidden="true" />}
      title="No sessions logged"
      description="Sessions will appear here once you start logging throws and training."
      action={
        onCreate && (
          <button className="btn-primary" onClick={onCreate}>
            Log Session
          </button>
        )
      }
    />
  );
}

export function NoResultsEmpty({ query }: { query?: string }) {
  return (
    <EmptyState
      compact
      icon={<Search size={24} strokeWidth={1.75} aria-hidden="true" />}
      title={query ? `No results for "${query}"` : "No results found"}
      description="Try different keywords or clear your filters."
    />
  );
}
