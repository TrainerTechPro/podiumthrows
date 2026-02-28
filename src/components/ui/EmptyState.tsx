import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Users, Calendar, Search } from "lucide-react";

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
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  suggestions,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "py-8 px-4 gap-2" : "py-16 px-6 gap-4",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "text-surface-300 dark:text-surface-600 shrink-0",
            compact ? "[&_svg]:w-6 [&_svg]:h-6" : "[&_svg]:w-9 [&_svg]:h-9"
          )}
        >
          {icon}
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
                "animate-chip-in",
              )}
              style={{ animationDelay: `${i * 75}ms` }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {action && <div className={cn(compact ? "mt-1" : "mt-2")}>{action}</div>}
    </div>
  );
}

/* ─── Pre-built themed empties ───────────────────────────────────────────── */

export function NoAthletesEmpty({ onInvite }: { onInvite?: () => void }) {
  return (
    <EmptyState
      icon={<Users size={24} strokeWidth={1.5} aria-hidden="true" />}
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
      icon={<Calendar size={24} strokeWidth={1.5} aria-hidden="true" />}
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
      icon={<Search size={24} strokeWidth={1.5} aria-hidden="true" />}
      title={query ? `No results for "${query}"` : "No results found"}
      description="Try different keywords or clear your filters."
    />
  );
}
