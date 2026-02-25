import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components";
import { requireAthleteSession, getAthleteImplementComparison } from "@/lib/data/athlete";
import { getAthleteThrowHistory, getAthleteThrowStats } from "@/lib/data/coach";
import { ThrowsChart } from "./_throws-chart";
import { ImplementComparisonChart } from "./_implement-comparison-chart";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type ThrowItem = {
  id: string;
  date: string;
  event: string;
  implementWeight: number;
  distance: number;
  isPersonalBest: boolean;
  isCompetition: boolean;
  notes: string | null;
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const EVENT_TABS = ["ALL", "SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"] as const;
type EventFilter = (typeof EVENT_TABS)[number];

/**
 * Compute trend from recent throws vs older throws.
 * Compares average of last 5 throws to average of 5 before that.
 */
function computeTrend(throws: ThrowItem[]): "improving" | "stable" | "declining" | null {
  if (throws.length < 4) return null;

  const recent = throws.slice(0, Math.min(5, Math.floor(throws.length / 2)));
  const older = throws.slice(recent.length, recent.length + recent.length);

  if (older.length === 0) return null;

  const recentAvg = recent.reduce((s, t) => s + t.distance, 0) / recent.length;
  const olderAvg = older.reduce((s, t) => s + t.distance, 0) / older.length;

  const diff = recentAvg - olderAvg;
  const pct = Math.abs(diff) / olderAvg;

  if (pct < 0.01) return "stable";
  return diff > 0 ? "improving" : "declining";
}

const TREND_CONFIG = {
  improving: { label: "Improving", color: "text-green-500", icon: "\u2191" },
  stable: { label: "Stable", color: "text-amber-500", icon: "\u2192" },
  declining: { label: "Declining", color: "text-red-500", icon: "\u2193" },
} as const;

/* ─── Stats Strip ─────────────────────────────────────────────────────────── */

function ThrowStats({
  throws,
  trend,
}: {
  throws: ThrowItem[];
  trend: "improving" | "stable" | "declining" | null;
}) {
  if (throws.length === 0) return null;

  const pr = Math.max(...throws.map((t) => t.distance));
  const latest = throws[0]?.distance ?? 0;
  const avg = throws.reduce((s, t) => s + t.distance, 0) / throws.length;

  const items = [
    { label: "Personal Best", value: `${pr.toFixed(2)}m` },
    { label: "Latest Throw", value: `${latest.toFixed(2)}m` },
    { label: `Avg (${throws.length})`, value: `${avg.toFixed(2)}m` },
  ];

  if (trend) {
    const t = TREND_CONFIG[trend];
    items.push({ label: "Trend", value: `${t.icon} ${t.label}` });
  }

  const cols = items.length;

  return (
    <div
      className={cn(
        "grid gap-px bg-[var(--card-border)] rounded-xl overflow-hidden border border-[var(--card-border)]",
        cols === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="bg-[var(--card-bg)] px-4 py-3">
          <p
            className={cn(
              "text-xl font-bold tabular-nums font-heading",
              item.label === "Trend" && trend
                ? TREND_CONFIG[trend].color
                : "text-[var(--foreground)]"
            )}
          >
            {item.value}
          </p>
          <p className="text-xs text-muted mt-0.5">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Throw Row ───────────────────────────────────────────────────────────── */

function ThrowRow({ t }: { t: ThrowItem }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[var(--foreground)] tabular-nums">
            {t.distance.toFixed(2)}m
          </span>
          {t.isPersonalBest && <Badge variant="warning">PR</Badge>}
          {t.isCompetition && <Badge variant="primary">Comp</Badge>}
        </div>
        <p className="text-xs text-muted mt-0.5">
          {formatDate(t.date)} · {t.implementWeight}kg {formatEventName(t.event)}
          {t.notes && ` · ${t.notes}`}
        </p>
      </div>
    </div>
  );
}

/* ─── Filter Pill ────────────────────────────────────────────────────────── */

function buildFilterUrl(
  base: Record<string, string | undefined>,
  override: Record<string, string | undefined>
): string {
  const params = new URLSearchParams();
  const merged = { ...base, ...override };
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return `/athlete/throws${qs ? `?${qs}` : ""}`;
}

/* ─── Page (Server, filter via searchParams) ─────────────────────────────── */

export default async function ThrowsPage({
  searchParams,
}: {
  searchParams: { event?: string; implement?: string; competition?: string };
}) {
  const { athlete } = await requireAthleteSession();

  const activeFilter = (searchParams.event?.toUpperCase() ?? "ALL") as EventFilter;
  const eventParam = activeFilter !== "ALL" ? activeFilter : undefined;
  const implementFilter = searchParams.implement
    ? parseFloat(searchParams.implement)
    : undefined;
  const competitionFilter = searchParams.competition === "true" ? true : undefined;

  // Build current search params for filter URLs
  const currentParams: Record<string, string | undefined> = {
    event: searchParams.event,
    implement: searchParams.implement,
    competition: searchParams.competition,
  };

  // Fetch throws
  let throws = await getAthleteThrowHistory(athlete.id, eventParam);

  // Client-side filters: implement weight
  if (implementFilter !== undefined) {
    throws = throws.filter((t) => t.implementWeight === implementFilter);
  }

  // Client-side filters: competition only
  if (competitionFilter) {
    throws = throws.filter((t) => t.isCompetition);
  }

  // Trend from unfiltered throws for current event
  const trend = computeTrend(throws);

  // Build chart data from filtered throws (ascending by date)
  const chartData = [...throws]
    .reverse()
    .map((t) => ({
      label: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: t.distance,
    }));

  // Get implement comparison data if a specific event is selected
  const implementComparisonData =
    eventParam
      ? await getAthleteImplementComparison(athlete.id, eventParam)
      : null;

  // Get stats for implement weight filter options
  const stats = await getAthleteThrowStats(athlete.id);
  const currentEventStats = eventParam
    ? stats.find((s) => s.event === eventParam)
    : null;
  const implementWeights = currentEventStats?.implementWeights ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Throw History
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {throws.length} throw{throws.length !== 1 ? "s" : ""} recorded
          </p>
        </div>
        <Link
          href="/athlete/throws/log"
          className="btn btn-primary text-sm shrink-0"
        >
          Log Throw
        </Link>
      </div>

      {/* Event filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {EVENT_TABS.map((tab) => (
          <Link
            key={tab}
            href={buildFilterUrl(
              {},
              {
                event:
                  tab === "ALL" ? undefined : tab.toLowerCase(),
              }
            )}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              activeFilter === tab
                ? "bg-primary-500 text-white"
                : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]"
            )}
          >
            {tab === "ALL" ? "All Events" : formatEventName(tab)}
          </Link>
        ))}
      </div>

      {/* Secondary Filters: Implement weight + Competition toggle */}
      {(implementWeights.length > 1 || eventParam) && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Implement weight filter */}
          {implementWeights.length > 1 && (
            <>
              <span className="text-xs text-muted font-medium">Weight:</span>
              <Link
                href={buildFilterUrl(currentParams, { implement: undefined })}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  !implementFilter
                    ? "bg-primary-500/15 text-primary-500"
                    : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]"
                )}
              >
                All
              </Link>
              {implementWeights.map((w) => (
                <Link
                  key={w}
                  href={buildFilterUrl(currentParams, {
                    implement: w.toString(),
                  })}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    implementFilter === w
                      ? "bg-primary-500/15 text-primary-500"
                      : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]"
                  )}
                >
                  {w}kg
                </Link>
              ))}
            </>
          )}

          {/* Competition toggle */}
          <span className="text-xs text-muted font-medium ml-auto">
            <Link
              href={buildFilterUrl(currentParams, {
                competition: competitionFilter ? undefined : "true",
              })}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1",
                competitionFilter
                  ? "bg-primary-500/15 text-primary-500"
                  : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Comp Only
            </Link>
          </span>
        </div>
      )}

      {/* Stats */}
      <ThrowStats throws={throws} trend={trend} />

      {/* Implement Comparison Chart (event-specific) */}
      {implementComparisonData && implementComparisonData.length > 1 && (
        <div className="card px-4 py-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
            Distance by Implement
          </h2>
          <ImplementComparisonChart seriesData={implementComparisonData} />
        </div>
      )}

      {/* Distance Over Time Chart */}
      {chartData.length > 1 && (
        <div className="card px-4 py-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
            Distance Over Time
          </h2>
          <ThrowsChart data={chartData} />
        </div>
      )}

      {/* Throw list */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
          All Throws
        </h2>
        {throws.length === 0 ? (
          <div className="card">
            <p className="text-sm text-muted py-8 text-center">
              {implementFilter || competitionFilter
                ? "No throws match the current filters."
                : "No throws recorded yet."}
            </p>
          </div>
        ) : (
          <div className="card divide-y divide-[var(--card-border)]">
            {throws.map((t) => (
              <ThrowRow key={t.id} t={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
