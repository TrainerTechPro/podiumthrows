import Link from "next/link";
import { Zap, ChevronRight } from "lucide-react";

/* ─── Freestyle CTA ─────────────────────────────────────────────────────────
   Fix for tester feedback 2026-04-10 ("can't do freestyle sessions outside
   programmed training"). Routes to the log-session wizard with no
   programId/assignmentId — the wizard already creates an AthleteThrowsSession
   when called without those. UI entry-point only; no backend change.
   ──────────────────────────────────────────────────────────────────────── */

type Variant = "compact" | "hero";

export function FreestyleCTA({ variant = "compact" }: { variant?: Variant }) {
  if (variant === "hero") {
    return (
      <Link
        href="/athlete/log-session"
        className="card card-interactive block p-5"
        aria-label="Log a freestyle session — a session that's not on your plan"
      >
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center shrink-0">
            <Zap
              size={20}
              strokeWidth={1.75}
              className="text-[var(--color-text-primary)]"
              aria-hidden="true"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)]">Freestyle session</p>
            <p className="text-xs text-muted">Log a session on your own — not on the plan</p>
          </div>
          <ChevronRight
            size={16}
            strokeWidth={1.75}
            className="text-muted shrink-0"
            aria-hidden="true"
          />
        </div>
      </Link>
    );
  }

  return (
    <Link
      href="/athlete/log-session"
      className="card card-interactive flex items-center gap-2.5 px-4 py-3"
      aria-label="Log a freestyle session — a session that's not on your plan"
    >
      <Zap
        size={14}
        strokeWidth={1.75}
        className="text-[var(--color-text-secondary)] shrink-0"
        aria-hidden="true"
      />
      <span className="flex-1 text-xs font-medium text-[var(--color-text-primary)]">
        Freestyle session
      </span>
      <ChevronRight
        size={14}
        strokeWidth={1.75}
        className="text-muted shrink-0"
        aria-hidden="true"
      />
    </Link>
  );
}
