import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface AdaptationRow {
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  complexNumber: number;
  sessionsInComplex: number;
  sessionsToForm: number | null;
  markSlope: number | null;
  markTrend: string;
  recommendation: string;
}

interface AdaptationProgressProps {
  rows: AdaptationRow[];
}

function TrendIcon({ slope }: { slope: number | null }) {
  if (slope == null) {
    return (
      <Minus
        className="h-3.5 w-3.5 text-surface-400"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    );
  }

  if (Math.abs(slope) < 0.05) {
    return (
      <Minus
        className="h-3.5 w-3.5 text-surface-400"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    );
  }

  if (slope > 0) {
    return (
      <TrendingUp
        className="h-3.5 w-3.5 text-emerald-500"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    );
  }

  return (
    <TrendingDown
      className="h-3.5 w-3.5 text-red-500"
      strokeWidth={1.75}
      aria-hidden="true"
    />
  );
}

function getPhaseBadge(
  recommendation: string,
  markTrend: string
): { label: string; variant: "success" | "danger" | "warning" | "neutral" } {
  switch (recommendation) {
    case "ADVANCE_PHASE":
      return { label: "In Form", variant: "success" };
    case "DELOAD":
    case "REDUCE_VOLUME":
      return { label: "Readapt Risk", variant: "danger" };
    case "ROTATE_COMPLEX":
      return { label: "Rotate", variant: "warning" };
    default:
      if (markTrend === "IMPROVING") {
        return { label: "Adapting", variant: "neutral" };
      }
      return { label: "Loading", variant: "neutral" };
  }
}

export function AdaptationProgress({ rows }: AdaptationProgressProps) {
  if (rows.length === 0) return null;

  return (
    <section className="space-y-3">
      {/* Header */}
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
        Adaptation Progress
      </h3>

      {/* Card with rows */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] divide-y divide-[var(--card-border)]">
        {rows.map((row, i) => {
          const phase = getPhaseBadge(row.recommendation, row.markTrend);

          return (
            <Link
              key={`${row.athleteId}-${row.complexNumber}-${i}`}
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
                  Complex {row.complexNumber} ·{" "}
                  {row.sessionsInComplex}
                  {row.sessionsToForm != null
                    ? ` / ${row.sessionsToForm} sessions`
                    : " sessions"}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <TrendIcon slope={row.markSlope} />
                <Badge variant={phase.variant}>{phase.label}</Badge>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
