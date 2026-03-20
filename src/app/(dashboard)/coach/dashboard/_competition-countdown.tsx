import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import type { UpcomingCompetition } from "@/lib/data/dashboard-intel";

interface CompetitionCountdownProps {
  competitions: UpcomingCompetition[];
}

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CompetitionCountdown({
  competitions,
}: CompetitionCountdownProps) {
  if (competitions.length === 0) return null;

  return (
    <section className="space-y-3">
      {/* Header */}
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
        Upcoming Competitions
      </h3>

      {/* Horizontal scroll row */}
      <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
        {competitions.map((comp) => (
          <div
            key={`${comp.id}-${comp.date}`}
            className="shrink-0 w-56 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 space-y-3"
          >
            {/* Top: priority badge + taper indicator */}
            <div className="flex items-center gap-2">
              <Badge
                variant={comp.priority === "A" ? "primary" : "neutral"}
                dot
              >
                {comp.priority}-Meet
              </Badge>
              {comp.taperWeek != null && (
                <Badge variant="warning">
                  Taper Wk {comp.taperWeek}
                </Badge>
              )}
            </div>

            {/* Days out — large number */}
            <div>
              <p
                className={cn(
                  "text-3xl font-bold tabular-nums",
                  comp.daysOut <= 7
                    ? "text-red-600 dark:text-red-400"
                    : comp.daysOut <= 21
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-[var(--foreground)]"
                )}
              >
                {comp.daysOut}
              </p>
              <p className="text-[10px] text-surface-400 -mt-0.5">
                days out
              </p>
            </div>

            {/* Competition name + event */}
            <div>
              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                {comp.name}
              </p>
              <p className="text-xs text-muted truncate">
                {formatEventName(comp.event)}
              </p>
            </div>

            {/* Avatar stack */}
            {comp.athletes.length > 0 && (
              <div className="flex items-center -space-x-2">
                {comp.athletes.slice(0, 4).map((athlete) => (
                  <Avatar
                    key={athlete.id}
                    name={athlete.name}
                    src={athlete.avatarUrl}
                    size="xs"
                    className="ring-2 ring-[var(--card-bg)]"
                  />
                ))}
                {comp.athletes.length > 4 && (
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-surface-100 dark:bg-surface-800 ring-2 ring-[var(--card-bg)] text-[9px] font-medium text-muted">
                    +{comp.athletes.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
