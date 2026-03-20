import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import { Award } from "lucide-react";
import type { TeamPR } from "@/lib/data/dashboard-intel";

interface PRBoardProps {
  prs: TeamPR[];
}

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PRBoard({ prs }: PRBoardProps) {
  if (prs.length === 0) return null;

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award
            className="h-5 w-5 text-amber-500"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Recent PRs
            </h3>
            <p className="text-[10px] text-surface-400">last 14 days</p>
          </div>
        </div>
        <Link
          href="/coach/throws"
          className="text-xs font-medium text-muted hover:text-[var(--foreground)] transition-colors"
        >
          View all
        </Link>
      </div>

      {/* Desktop — flex-based rows */}
      <div className="hidden sm:block space-y-1">
        {prs.map((pr, i) => (
          <Link
            key={`${pr.athleteId}-${pr.event}-${pr.date}-${i}`}
            href={`/coach/athletes/${pr.athleteId}`}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
              "hover:bg-surface-50 dark:hover:bg-surface-800/50"
            )}
          >
            <Avatar
              name={pr.athleteName}
              src={pr.avatarUrl}
              size="xs"
            />

            <span className="text-sm font-medium text-[var(--foreground)] w-36 truncate">
              {pr.athleteName}
            </span>

            <span className="text-xs text-muted w-28 truncate">
              {formatEventName(pr.event)}
            </span>

            <span className="text-xs text-surface-400 w-16 truncate">
              {pr.implement}
            </span>

            <span className="text-sm font-bold tabular-nums text-amber-500 w-20 text-right">
              {pr.distance.toFixed(2)}m
            </span>

            <span className="text-xs text-surface-400 w-16 text-right">
              {formatDate(pr.date)}
            </span>

            {pr.source && (
              <Badge
                variant={pr.source === "COMPETITION" ? "primary" : "neutral"}
                className="ml-auto"
              >
                {pr.source === "COMPETITION" ? "Comp" : "Training"}
              </Badge>
            )}
          </Link>
        ))}
      </div>

      {/* Mobile — stacked cards */}
      <div className="sm:hidden space-y-2">
        {prs.map((pr, i) => (
          <Link
            key={`mobile-${pr.athleteId}-${pr.event}-${pr.date}-${i}`}
            href={`/coach/athletes/${pr.athleteId}`}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 transition-colors",
              "hover:bg-surface-50 dark:hover:bg-surface-800/50"
            )}
          >
            <Avatar
              name={pr.athleteName}
              src={pr.avatarUrl}
              size="sm"
            />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                {pr.athleteName}
              </p>
              <p className="text-xs text-muted truncate">
                {formatEventName(pr.event)} · {pr.implement}
              </p>
            </div>

            <div className="text-right shrink-0">
              <p className="text-sm font-bold tabular-nums text-amber-500">
                {pr.distance.toFixed(2)}m
              </p>
              <p className="text-[10px] text-surface-400">
                {formatDate(pr.date)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
