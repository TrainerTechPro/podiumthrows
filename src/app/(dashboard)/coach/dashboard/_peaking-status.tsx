import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { generateTaperPlan } from "@/lib/throws/profile-utils";
import type { UpcomingCompetition } from "@/lib/data/dashboard-intel";
import type { TeamReadinessEntry } from "@/lib/data/coach";

interface PeakingStatusProps {
  competitions: UpcomingCompetition[];
  readiness: TeamReadinessEntry[];
}

interface PeakingRow {
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  competitionName: string;
  daysOut: number;
  taperWeek: number | null;
  volumeReduction: number | null;
  readinessScore: number | null;
  readinessMaxScore: number;
  readinessTrend: "up" | "down" | "stable" | null;
}

function readinessColor(score: number | null, max: number): string {
  if (score == null) return "text-muted";
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.8) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 0.6) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function TrendIcon({
  trend,
}: {
  trend: "up" | "down" | "stable" | null;
}) {
  if (trend === "up")
    return (
      <TrendingUp
        className="h-3.5 w-3.5 text-emerald-500"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    );
  if (trend === "down")
    return (
      <TrendingDown
        className="h-3.5 w-3.5 text-red-500"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    );
  if (trend === "stable")
    return (
      <Minus
        className="h-3.5 w-3.5 text-surface-400"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    );
  return null;
}

export function PeakingStatus({
  competitions,
  readiness,
}: PeakingStatusProps) {
  // Build per-athlete rows from competitions
  const rows: PeakingRow[] = [];

  for (const comp of competitions) {
    const taper = generateTaperPlan(comp.daysOut);

    for (const athlete of comp.athletes) {
      const volumeReduction =
        taper != null
          ? Math.round((1 - taper.volumeMultiplier) * 100)
          : null;

      const matchedReadiness = readiness.find(
        (r) => r.athleteId === athlete.id
      );

      rows.push({
        athleteId: athlete.id,
        athleteName: athlete.name,
        avatarUrl: athlete.avatarUrl,
        competitionName: comp.name,
        daysOut: comp.daysOut,
        taperWeek: comp.taperWeek,
        volumeReduction,
        readinessScore: matchedReadiness?.latestScore ?? null,
        readinessMaxScore: matchedReadiness?.maxScore ?? 0,
        readinessTrend: matchedReadiness?.trend ?? null,
      });
    }
  }

  if (rows.length === 0) return null;

  return (
    <section className="space-y-3">
      {/* Header */}
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
        Peaking Status
      </h3>

      {/* Card with rows */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] divide-y divide-[var(--card-border)]">
        {rows.map((row, i) => (
          <Link
            key={`${row.athleteId}-${row.competitionName}-${i}`}
            href={`/coach/athletes/${row.athleteId}`}
            className={cn(
              "flex items-center gap-3 px-4 py-3 transition-colors",
              "hover:bg-surface-50 dark:hover:bg-surface-800/50"
            )}
          >
            <Avatar
              name={row.athleteName}
              src={row.avatarUrl}
              size="sm"
            />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                {row.athleteName}
              </p>
              <p className="text-xs text-muted truncate">
                {row.competitionName} · {row.daysOut}d out
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Taper badge */}
              {row.taperWeek != null && (
                <Badge variant="warning">
                  Taper {row.taperWeek}
                </Badge>
              )}

              {/* Volume reduction */}
              {row.volumeReduction != null && (
                <span className="text-xs font-medium tabular-nums text-muted">
                  -{row.volumeReduction}% vol
                </span>
              )}

              {/* Readiness score */}
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    readinessColor(row.readinessScore, row.readinessMaxScore)
                  )}
                >
                  {row.readinessScore != null ? row.readinessScore : "—"}
                </span>
                <TrendIcon trend={row.readinessTrend} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
