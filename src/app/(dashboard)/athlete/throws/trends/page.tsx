"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import dynamic from "next/dynamic";
import {
  useEventChartSettings,
  rangeStartDate,
  DATE_RANGE_LABELS,
  type DateRangeKey,
} from "@/lib/hooks/useEventChartSettings";
import { formatImplementDisplay } from "@/lib/throws/display";
import { ThrowsChipNav } from "../_chip-nav";
import { useUnitPref } from "@/lib/units/provider";
import { UnitToggle } from "@/components/units/UnitToggle";

import { logger } from "@/lib/logger";
const DistanceTrendChart = dynamic(
  () => import("./_distance-chart").then((m) => m.DistanceTrendChart),
  { ssr: false, loading: () => <div className="shimmer h-64 rounded-xl" /> }
);

// ── Constants ──────────────────────────────────────────────────────────

const EVENT_META: Record<string, { label: string; color: string }> = {
  SHOT_PUT: { label: "Shot Put", color: "#E85D26" },
  DISCUS: { label: "Discus", color: "#2563EB" },
  HAMMER: { label: "Hammer", color: "#7C3AED" },
  JAVELIN: { label: "Javelin", color: "#059669" },
};

const EVENT_ORDER = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];

// Competition weights by event × gender. Keep this inline so the client doesn't
// need to import from a server-only module.
const COMP_WEIGHTS: Record<string, { MALE: number; FEMALE: number }> = {
  SHOT_PUT: { MALE: 7.26, FEMALE: 4 },
  DISCUS: { MALE: 2, FEMALE: 1 },
  HAMMER: { MALE: 7.26, FEMALE: 4 },
  JAVELIN: { MALE: 0.8, FEMALE: 0.6 },
};

function compLabelFor(event: string, gender: "MALE" | "FEMALE" | null): string | null {
  if (!gender) return null;
  const std = COMP_WEIGHTS[event];
  if (!std) return null;
  return formatImplementDisplay(std[gender], event, gender, { showComp: false });
}

function compKgFor(event: string, gender: "MALE" | "FEMALE" | null): number | null {
  if (!gender) return null;
  const std = COMP_WEIGHTS[event];
  if (!std) return null;
  return std[gender];
}

// ── Types ──────────────────────────────────────────────────────────────

interface TrendPoint {
  date: string;
  event: string;
  distance: number;
  source: string;
  implementKg: number;
  implementLabel: string;
}

interface PRRecord {
  event: string;
  implement: string;
  distance: number;
  date: string;
  source: string;
}

interface CompPracticeSplit {
  competition: { count: number; avgDistance: number };
  practice: { count: number; avgDistance: number };
}

interface ImplDistRow {
  event: string;
  implement: string;
  throwCount: number;
  avgDistance: number;
  bestDistance: number;
}

interface AnalysisData {
  gender: "MALE" | "FEMALE" | null;
  athleteId: string | null;
  distanceTrends: TrendPoint[];
  prTimeline: PRRecord[];
  competitionVsPractice: CompPracticeSplit;
  implementDistribution: ImplDistRow[];
}

// ── Helpers ────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmtDateLong(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ── Page ───────────────────────────────────────────────────────────────

export default function ThrowAnalysisPage() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Distance display unit drives the PR list, comp/practice avg row, and the
  // per-implement breakdown table. Per-event charts each read the same hook
  // independently for their tooltip + Y-axis formatting.
  const { format: formatDist } = useUnitPref("throwDistance");

  useEffect(() => {
    fetch("/api/athlete/throws/analysis")
      .then(async (r) => {
        const payload = await r.json().catch(() => null);
        if (!r.ok || !payload?.success || !payload.data) {
          throw new Error(payload?.error || `Failed (${r.status})`);
        }
        setData(payload.data as AnalysisData);
        setLoading(false);
      })
      .catch((err) => {
        logger.error("throws analysis fetch failed", {
          context: "athlete/throws/trends",
          error: err,
        });
        setError(true);
        setLoading(false);
      });
  }, []);

  // ── Loading skeleton ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-spring-up space-y-5 max-w-3xl mx-auto pb-8">
        <div className="shimmer-contextual h-8 w-56 rounded-lg" />
        <div className="shimmer-contextual h-4 w-40 rounded" />
        <div className="shimmer-contextual h-72 rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="shimmer-contextual h-32 rounded-xl" />
          <div className="shimmer-contextual h-32 rounded-xl" />
        </div>
        <div className="shimmer-contextual h-48 rounded-xl" />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div className="animate-spring-up max-w-3xl mx-auto pb-8">
        <div className="card">
          <EmptyState
            title="Unable to load analysis"
            description="Something went wrong fetching your throw data. Please try again."
            action={
              <button className="btn-primary" onClick={() => window.location.reload()}>
                Retry
              </button>
            }
          />
        </div>
      </div>
    );
  }

  // ── No data at all ─────────────────────────────────────────────────

  const hasData =
    data.distanceTrends.length > 0 ||
    data.prTimeline.length > 0 ||
    data.competitionVsPractice.competition.count > 0 ||
    data.competitionVsPractice.practice.count > 0;

  if (!hasData) {
    return (
      <div className="animate-spring-up max-w-3xl mx-auto pb-8 space-y-5">
        <Header />
        <div className="card">
          <EmptyState
            title="No throw data yet"
            description="Start logging throws in practice or competition to see your analysis dashboard."
            action={
              <Link href="/athlete/throws" className="btn-primary">
                Go to Throws
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  // ── Group data by event ────────────────────────────────────────────

  const eventsWithData = EVENT_ORDER.filter((ev) =>
    data.distanceTrends.some((t) => t.event === ev)
  );

  // Group implement distribution by event (for the bottom section)
  const implByEvent = new Map<string, ImplDistRow[]>();
  for (const row of data.implementDistribution) {
    const arr = implByEvent.get(row.event) ?? [];
    arr.push(row);
    implByEvent.set(row.event, arr);
  }

  const totalComp = data.competitionVsPractice.competition;
  const totalPract = data.competitionVsPractice.practice;
  const maxCount = Math.max(totalComp.count, totalPract.count, 1);

  return (
    <div className="animate-spring-up space-y-6 max-w-3xl mx-auto pb-8">
      <ThrowsChipNav />
      <Header />

      {/* ── Per-event chart cards ──────────────────────────────────── */}
      {eventsWithData.length === 0 ? (
        <section className="card !p-5">
          <p className="text-sm text-muted text-center">No distance data logged yet.</p>
        </section>
      ) : (
        eventsWithData.map((event) => (
          <EventChartCard
            key={event}
            event={event}
            trends={data.distanceTrends.filter((t) => t.event === event)}
            gender={data.gender}
            athleteId={data.athleteId}
          />
        ))
      )}

      {/* ── PR Progression Timeline ────────────────────────────────── */}
      <section className="card !p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
            PR Progression
          </h2>
          <p className="text-xs text-muted mt-0.5">Personal record achievements over time</p>
        </div>

        {data.prTimeline.length > 0 ? (
          <div className="relative ml-3">
            <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-[var(--card-border)]" />
            <div className="space-y-4">
              {data.prTimeline.map((pr, i) => {
                const meta = EVENT_META[pr.event];
                return (
                  <div key={`${pr.event}-${pr.implement}-${i}`} className="relative pl-6">
                    <div
                      className="absolute left-0 top-2 w-3 h-3 rounded-full border-2 border-white dark:border-[var(--card-bg)] -translate-x-[5px]"
                      style={{ backgroundColor: meta?.color ?? "#666" }}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-nano font-bold text-white"
                            style={{ backgroundColor: meta?.color ?? "#666" }}
                          >
                            {meta?.label ?? pr.event}
                          </span>
                          <span className="text-xs text-muted font-mono">{pr.implement}</span>
                          <span className="text-nano px-1.5 py-0.5 rounded bg-[var(--muted-bg)] text-muted font-medium">
                            {pr.source === "COMPETITION" ? "Competition" : "Training"}
                          </span>
                        </div>
                        <p className="text-xs text-surface-700 dark:text-surface-300 mt-1">
                          {fmtDateLong(pr.date)}
                        </p>
                      </div>
                      <span className="text-lg font-bold font-mono text-primary-600 dark:text-primary-300 whitespace-nowrap">
                        {formatDist(pr.distance)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-muted">No personal records recorded yet.</p>
          </div>
        )}
      </section>

      {/* ── Competition vs Practice ────────────────────────────────── */}
      <section className="card !p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
            Competition vs Practice
          </h2>
          <p className="text-xs text-muted mt-0.5">Throw volume and average distance split</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-[var(--card-border)] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-xs font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
                Competition
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-[var(--foreground)]">
                {totalComp.count}
              </p>
              <p className="text-xs text-muted">throws</p>
            </div>
            {totalComp.avgDistance > 0 && (
              <div>
                <p className="text-sm font-semibold text-primary-600 dark:text-primary-300">
                  {formatDist(totalComp.avgDistance)} avg
                </p>
              </div>
            )}
            <div className="w-full h-2 bg-[var(--muted-bg)] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-700"
                style={{ width: `${(totalComp.count / maxCount) * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--card-border)] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-xs font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
                Practice
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-[var(--foreground)]">
                {totalPract.count}
              </p>
              <p className="text-xs text-muted">throws</p>
            </div>
            {totalPract.avgDistance > 0 && (
              <div>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {formatDist(totalPract.avgDistance)} avg
                </p>
              </div>
            )}
            <div className="w-full h-2 bg-[var(--muted-bg)] rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-700"
                style={{ width: `${(totalPract.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Implement Weight Distribution ──────────────────────────── */}
      <section className="card !p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
            Implement Distribution
          </h2>
          <p className="text-xs text-muted mt-0.5">Throw count and distances by implement weight</p>
        </div>

        {data.implementDistribution.length > 0 ? (
          <div className="space-y-5">
            {Array.from(implByEvent.entries()).map(([event, rows]) => {
              const meta = EVENT_META[event];
              return (
                <div key={event}>
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="w-2 h-6 rounded-full"
                      style={{ backgroundColor: meta?.color ?? "#666" }}
                    />
                    <h3 className="text-sm font-bold text-[var(--foreground)]">
                      {meta?.label ?? event}
                    </h3>
                  </div>
                  <div className="divide-y divide-[var(--card-border)]">
                    {rows.map((row) => (
                      <div
                        key={`${row.event}-${row.implement}`}
                        className="py-3 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold font-mono text-[var(--foreground)]">
                            {row.implement}
                          </p>
                          <p className="text-xs text-surface-700 dark:text-surface-300">
                            {row.throwCount} throw
                            {row.throwCount !== 1 ? "s" : ""} &middot; avg{" "}
                            {formatDist(row.avgDistance)}
                          </p>
                        </div>
                        <span className="text-base font-bold font-mono text-orange-600 dark:text-orange-400 whitespace-nowrap">
                          {formatDist(row.bestDistance)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-muted">No implement data yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Header Component ────────────────────────────────────────────────────

function Header() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-display font-heading text-[var(--foreground)]">Throw Analysis</h1>
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Distance trends, PRs, and implement breakdown
        </p>
      </div>
      <Link
        href="/athlete/throws"
        className="text-sm text-primary-600 dark:text-primary-300 hover:underline"
      >
        &larr; Throws
      </Link>
    </div>
  );
}

// ── Per-Event Chart Card ────────────────────────────────────────────────

interface EventChartCardProps {
  event: string;
  trends: TrendPoint[];
  gender: "MALE" | "FEMALE" | null;
  athleteId: string | null;
}

function EventChartCard({ event, trends, gender, athleteId }: EventChartCardProps) {
  const meta = EVENT_META[event];
  const compLabel = compLabelFor(event, gender);
  const compKg = compKgFor(event, gender);

  // Distance display unit — chart Y-axis + tooltip render in this unit. Inline
  // toggle next to the chart title lets the athlete flip without leaving the page.
  const distancePref = useUnitPref("throwDistance");
  const distanceUnit = distancePref.unit;

  const { settings, setDateRange, toggleWeight, resetToComp } = useEventChartSettings(
    athleteId,
    event,
    compLabel
  );

  // All implement labels that appear in this event's data, sorted by kg
  const allImplements = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of trends) {
      if (!map.has(t.implementLabel)) map.set(t.implementLabel, t.implementKg);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([label, kg]) => ({ label, kg }));
  }, [trends]);

  const implementKgMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const { label, kg } of allImplements) m[label] = kg;
    return m;
  }, [allImplements]);

  // Apply date filter
  const rangeStart = rangeStartDate(settings.dateRange);
  const dateFilteredTrends = useMemo(
    () => (rangeStart ? trends.filter((t) => t.date >= rangeStart) : trends),
    [trends, rangeStart]
  );

  const hiddenByDate = trends.length - dateFilteredTrends.length;

  // Apply weight filter (after date filter). Only show weights the user has toggled on.
  const visibleSet = new Set(settings.visibleWeights);
  const visibleTrends = useMemo(
    () => dateFilteredTrends.filter((t) => visibleSet.has(t.implementLabel)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateFilteredTrends, settings.visibleWeights]
  );

  // Aggregate: best distance per date per implement, then convert from canonical
  // meters to the athlete's chosen display unit so the chart Y-axis + tooltips
  // render in feet for imperial users without recharts knowing about units.
  const chartData = useMemo(() => {
    const mToDisplay = (m: number) => (distanceUnit === "imperial" ? m / 0.3048 : m);
    const byDate = new Map<string, Record<string, number>>();
    for (const t of visibleTrends) {
      const existing = byDate.get(t.date) ?? {};
      const prev = (existing[t.implementLabel] as number | undefined) ?? 0;
      if (t.distance > prev) existing[t.implementLabel] = t.distance;
      byDate.set(t.date, existing);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => {
        const converted: Record<string, number> = {};
        for (const [k, v] of Object.entries(values)) converted[k] = mToDisplay(v);
        return { date: fmtDate(date), ...converted };
      });
  }, [visibleTrends, distanceUnit]);

  const visibleImplementKeys = settings.visibleWeights.filter((w) =>
    allImplements.some((i) => i.label === w)
  );

  const hasAnyVisibleData = chartData.length > 0 && visibleImplementKeys.length > 0;

  return (
    <section className="card !p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-6 rounded-full"
            style={{ backgroundColor: meta?.color ?? "#666" }}
          />
          <div>
            <h2 className="text-base font-bold text-[var(--foreground)]">{meta?.label ?? event}</h2>
            <p className="text-xs text-muted mt-0.5">Distance progression by implement</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UnitToggle type="throwDistance" size="compact" />
          {/* Date range picker */}
          <select
            value={settings.dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRangeKey)}
            className="text-xs px-3 min-h-[44px] rounded-md bg-[var(--muted-bg)] border border-[var(--card-border)] text-surface-700 dark:text-surface-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
            aria-label="Date range"
          >
            {(Object.keys(DATE_RANGE_LABELS) as DateRangeKey[]).map((key) => (
              <option key={key} value={key}>
                {DATE_RANGE_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Weight toggle chips */}
      <div className="flex flex-wrap gap-2">
        {allImplements.map(({ label, kg }) => {
          const isVisible = visibleSet.has(label);
          const isComp = compKg != null && Math.abs(kg - compKg) < 0.01;
          return (
            <button
              key={label}
              onClick={() => toggleWeight(label)}
              className={`text-micro font-mono font-semibold px-3 min-h-[44px] rounded-md border transition-colors ${
                isVisible
                  ? isComp
                    ? "bg-primary-500 border-primary-500 text-white"
                    : "bg-[var(--muted-bg)] border-[var(--card-border)] text-[var(--foreground)]"
                  : "border-dashed border-[var(--card-border)] text-muted hover:bg-[var(--muted-bg)]"
              }`}
              aria-pressed={isVisible}
            >
              {isVisible ? "" : "+ "}
              {label}
              {isComp && " ★"}
            </button>
          );
        })}
      </div>

      {/* Chart or empty state */}
      {hasAnyVisibleData ? (
        <DistanceTrendChart
          chartData={chartData}
          implementKeys={visibleImplementKeys}
          implementKgMap={implementKgMap}
          compKg={compKg}
          unit={distanceUnit}
        />
      ) : (
        <div className="py-10 text-center space-y-2">
          <p className="text-sm text-muted">
            {visibleImplementKeys.length === 0
              ? "No implement weights selected."
              : "No data in the selected date range."}
          </p>
          {visibleImplementKeys.length === 0 && compLabel && (
            <button
              onClick={resetToComp}
              className="text-xs text-primary-600 dark:text-primary-300 hover:underline"
            >
              Reset to {compLabel}
            </button>
          )}
        </div>
      )}

      {/* Hidden-by-date-filter banner */}
      {hiddenByDate > 0 && (
        <div className="text-xs text-muted bg-[var(--muted-bg)] rounded-md px-3 py-2 flex items-center justify-between gap-3">
          <span>
            {hiddenByDate} older throw{hiddenByDate === 1 ? "" : "s"} hidden by date filter
          </span>
          <button
            onClick={() => setDateRange("all")}
            className="text-primary-600 dark:text-primary-300 hover:underline font-medium"
          >
            Show all
          </button>
        </div>
      )}
    </section>
  );
}
