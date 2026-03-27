import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import { Award, BarChart3 } from "lucide-react";
import type { SeasonGainEntry } from "@/lib/data/dashboard-intel";

const EVENT_SHORT: Record<string, string> = {
  SHOT_PUT: "SP",
  DISCUS: "DT",
  HAMMER: "HT",
  JAVELIN: "JT",
};

function formatEventShort(event: string): string {
  return EVENT_SHORT[event] ?? event.slice(0, 2).toUpperCase();
}

export function SeasonGains({
  entries,
  period,
}: {
  entries: SeasonGainEntry[];
  period: number;
}) {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Award
          className="w-4 h-4 text-amber-500"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
          Top Performers
          <span className="ml-1.5 text-surface-400 font-normal normal-case">
            {period}d gains
          </span>
        </h3>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8 gap-2">
          <BarChart3
            className="w-5 h-5 text-surface-400"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <p className="text-xs text-muted">No distance data yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((entry, i) => (
            <Link
              key={entry.athleteId}
              href={`/coach/athletes/${entry.athleteId}`}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
            >
              {/* Rank */}
              <span
                className={cn(
                  "w-5 text-center shrink-0",
                  i === 0 ? "text-amber-500" : "text-surface-400"
                )}
              >
                {i === 0 ? (
                  <Award
                    className="w-4 h-4 inline"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                ) : (
                  <span className="text-xs font-bold tabular-nums">
                    {i + 1}
                  </span>
                )}
              </span>

              <Avatar
                name={entry.athleteName}
                src={entry.avatarUrl}
                size="xs"
              />

              <span className="text-sm font-medium text-[var(--foreground)] flex-1 truncate">
                {entry.athleteName}
              </span>

              <span className="text-sm font-bold tabular-nums text-emerald-500 shrink-0">
                +{entry.deltaMeters.toFixed(2)}m
              </span>

              <Badge variant="neutral">
                {formatEventShort(entry.event)}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
