import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Icon or illustration */
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Compact layout for tables / small containers */
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
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
            "rounded-2xl bg-surface-100 dark:bg-surface-800/60 text-surface-400 dark:text-surface-500 flex items-center justify-center shrink-0",
            compact ? "w-10 h-10 [&_svg]:w-5 [&_svg]:h-5" : "w-16 h-16 [&_svg]:w-8 [&_svg]:h-8"
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

      {action && <div className={cn(compact ? "mt-1" : "mt-2")}>{action}</div>}
    </div>
  );
}

/* ─── Pre-built themed empties ───────────────────────────────────────────── */

export function NoAthletesEmpty({ onInvite }: { onInvite?: () => void }) {
  return (
    <EmptyState
      icon={<AthleteIcon />}
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
      icon={<SessionIcon />}
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
      icon={<SearchIcon />}
      title={query ? `No results for "${query}"` : "No results found"}
      description="Try different keywords or clear your filters."
    />
  );
}

/* ─── Inline icons ───────────────────────────────────────────────────────── */

function AthleteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SessionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
