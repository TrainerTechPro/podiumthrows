import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import type { TeamLoadEntry } from "@/lib/data/dashboard-intel";
import type { DashboardDepth } from "./_mode-selector";

interface LoadOverviewProps {
  entries: TeamLoadEntry[];
  depth: DashboardDepth;
}

function acwrColor(acwr: number | null): string {
  if (acwr == null) return "text-muted";
  if (acwr > 1.3) return "text-red-600 dark:text-red-400";
  if (acwr > 1.0) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

function riskBadgeVariant(
  risk: "low" | "moderate" | "high" | null
): "danger" | "warning" | "success" | "neutral" {
  if (risk === "high") return "danger";
  if (risk === "moderate") return "warning";
  if (risk === "low") return "success";
  return "neutral";
}

function riskLabel(risk: "low" | "moderate" | "high" | null): string {
  if (risk === "high") return "High";
  if (risk === "moderate") return "Moderate";
  if (risk === "low") return "Low";
  return "—";
}

function formatPhase(phase: string | null): string {
  if (!phase) return "—";
  return phase
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LoadOverview({ entries, depth }: LoadOverviewProps) {
  if (entries.length === 0) return null;

  const isAdvanced = depth === "advanced";

  return (
    <section className="space-y-3">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Training Load
        </h3>
        <p className="text-[10px] text-surface-400">7-day overview</p>
      </div>

      {/* Desktop — table */}
      <div className="hidden sm:block rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--card-border)]">
              <th className="px-4 py-2.5 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
                Athlete
              </th>
              <th className="px-4 py-2.5 text-[10px] font-semibold text-surface-400 uppercase tracking-wider text-right">
                Throws
              </th>
              <th className="px-4 py-2.5 text-[10px] font-semibold text-surface-400 uppercase tracking-wider text-right">
                ACWR
              </th>
              <th className="px-4 py-2.5 text-[10px] font-semibold text-surface-400 uppercase tracking-wider text-right">
                Risk
              </th>
              {isAdvanced && (
                <>
                  <th className="hidden md:table-cell px-4 py-2.5 text-[10px] font-semibold text-surface-400 uppercase tracking-wider text-right">
                    Phase
                  </th>
                  <th className="hidden md:table-cell px-4 py-2.5 text-[10px] font-semibold text-surface-400 uppercase tracking-wider text-right">
                    Deficit
                  </th>
                  <th className="hidden md:table-cell px-4 py-2.5 text-[10px] font-semibold text-surface-400 uppercase tracking-wider text-right">
                    STF
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--card-border)]">
            {entries.map((entry) => (
              <tr
                key={entry.athleteId}
                className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/coach/athletes/${entry.athleteId}`}
                    className="flex items-center gap-2.5"
                  >
                    <Avatar
                      name={entry.athleteName}
                      src={entry.avatarUrl}
                      size="xs"
                    />
                    <span className="text-sm font-medium text-[var(--foreground)] truncate max-w-[10rem]">
                      {entry.athleteName}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="text-sm tabular-nums text-[var(--foreground)]">
                    {entry.throwsThisWeek}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      acwrColor(entry.acwr)
                    )}
                  >
                    {entry.acwr != null ? entry.acwr.toFixed(2) : "—"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Badge variant={riskBadgeVariant(entry.riskLevel)}>
                    {riskLabel(entry.riskLevel)}
                  </Badge>
                </td>
                {isAdvanced && (
                  <>
                    <td className="hidden md:table-cell px-4 py-2.5 text-right">
                      <span className="text-xs text-muted">
                        {formatPhase(entry.adaptationPhase)}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-2.5 text-right">
                      <span className="text-xs text-muted">
                        {entry.deficitClassification ?? "—"}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-2.5 text-right">
                      <span className="text-xs tabular-nums text-muted">
                        {entry.sessionsToForm != null
                          ? entry.sessionsToForm
                          : "—"}
                      </span>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile — stacked cards */}
      <div className="sm:hidden space-y-2">
        {entries.map((entry) => (
          <Link
            key={`mobile-${entry.athleteId}`}
            href={`/coach/athletes/${entry.athleteId}`}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 transition-colors",
              "hover:bg-surface-50 dark:hover:bg-surface-800/50"
            )}
          >
            <Avatar
              name={entry.athleteName}
              src={entry.avatarUrl}
              size="sm"
            />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                {entry.athleteName}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-full bg-surface-100 dark:bg-surface-800 px-2 py-0.5 text-[10px] font-medium text-[var(--foreground)]">
                  {entry.throwsThisWeek} throws
                </span>
                {entry.acwr != null && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full bg-surface-100 dark:bg-surface-800 px-2 py-0.5 text-[10px] font-medium tabular-nums",
                      acwrColor(entry.acwr)
                    )}
                  >
                    {entry.acwr.toFixed(2)}
                  </span>
                )}
                <Badge variant={riskBadgeVariant(entry.riskLevel)}>
                  {riskLabel(entry.riskLevel)}
                </Badge>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
