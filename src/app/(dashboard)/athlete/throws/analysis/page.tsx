"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

// ── Constants ──────────────────────────────────────────────────────────

const EVENT_META: Record<string, { label: string; color: string }> = {
  SHOT_PUT: { label: "Shot Put", color: "#E85D26" },
  DISCUS: { label: "Discus", color: "#2563EB" },
  HAMMER: { label: "Hammer", color: "#7C3AED" },
  JAVELIN: { label: "Javelin", color: "#059669" },
};

// ── Types ──────────────────────────────────────────────────────────────

interface TrendPoint {
  date: string;
  event: string;
  distance: number;
  source: string;
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
  const [eventFilter, setEventFilter] = useState<string>("");

  useEffect(() => {
    fetch("/api/athlete/throws/analysis")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d: AnalysisData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
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
              <button
                className="btn-primary"
                onClick={() => window.location.reload()}
              >
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

  // ── Filter distance trends by event ────────────────────────────────

  const filteredTrends = eventFilter
    ? data.distanceTrends.filter((t) => t.event === eventFilter)
    : data.distanceTrends;

  // Build chart data: aggregate best distance per date per event
  const chartDataMap = new Map<string, Record<string, number>>();
  const eventsInData = new Set<string>();

  for (const pt of filteredTrends) {
    eventsInData.add(pt.event);
    const existing = chartDataMap.get(pt.date);
    if (existing) {
      const prevBest = existing[pt.event] ?? 0;
      if (pt.distance > prevBest) existing[pt.event] = pt.distance;
    } else {
      chartDataMap.set(pt.date, { [pt.event]: pt.distance });
    }
  }

  const chartData = Array.from(chartDataMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date: fmtDate(date),
      ...values,
    }));

  const eventKeys = Array.from(eventsInData);

  // Filter implement distribution
  const filteredImplDist = eventFilter
    ? data.implementDistribution.filter((r) => r.event === eventFilter)
    : data.implementDistribution;

  // Group implement distribution by event
  const implByEvent = new Map<string, ImplDistRow[]>();
  for (const row of filteredImplDist) {
    const arr = implByEvent.get(row.event) ?? [];
    arr.push(row);
    implByEvent.set(row.event, arr);
  }

  // Filter PR timeline
  const filteredPRs = eventFilter
    ? data.prTimeline.filter((p) => p.event === eventFilter)
    : data.prTimeline;

  const totalComp = data.competitionVsPractice.competition;
  const totalPract = data.competitionVsPractice.practice;
  const maxCount = Math.max(totalComp.count, totalPract.count, 1);

  return (
    <div className="animate-spring-up space-y-6 max-w-3xl mx-auto pb-8">
      <Header />

      {/* Event filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setEventFilter("")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            eventFilter === ""
              ? "bg-primary-500 text-white"
              : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300 hover:bg-[var(--muted-bg)]"
          }`}
        >
          All Events
        </button>
        {Object.entries(EVENT_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setEventFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              eventFilter === key
                ? "text-white"
                : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300 hover:bg-[var(--muted-bg)]"
            }`}
            style={eventFilter === key ? { backgroundColor: meta.color } : {}}
          >
            {meta.label}
          </button>
        ))}
      </div>

      {/* ── Section 1: Distance Trends ─────────────────────────────── */}
      <section className="card !p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
            Distance Trends
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Best distance per day by event
          </p>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 8, bottom: 4, left: -10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--card-border)"
                opacity={0.5}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--muted)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                tickFormatter={(v: number) => `${v}m`}
              />
              <Tooltip
                formatter={(val: number, name: string) => [
                  `${val.toFixed(2)}m`,
                  EVENT_META[name]?.label ?? name,
                ]}
                contentStyle={{
                  backgroundColor: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) =>
                  EVENT_META[value]?.label ?? value
                }
              />
              {eventKeys.map((ev) => (
                <Line
                  key={ev}
                  type="monotone"
                  dataKey={ev}
                  name={ev}
                  stroke={EVENT_META[ev]?.color ?? "#666"}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-10 text-center">
            <p className="text-sm text-muted">
              No distance data for the selected filter.
            </p>
          </div>
        )}
      </section>

      {/* ── Section 2: PR Progression Timeline ─────────────────────── */}
      <section className="card !p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
            PR Progression
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Personal record achievements over time
          </p>
        </div>

        {filteredPRs.length > 0 ? (
          <div className="relative ml-3">
            {/* Vertical line */}
            <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-[var(--card-border)]" />

            <div className="space-y-4">
              {filteredPRs.map((pr, i) => {
                const meta = EVENT_META[pr.event];
                return (
                  <div key={`${pr.event}-${pr.implement}-${i}`} className="relative pl-6">
                    {/* Dot on timeline */}
                    <div
                      className="absolute left-0 top-2 w-3 h-3 rounded-full border-2 border-white dark:border-[var(--card-bg)] -translate-x-[5px]"
                      style={{ backgroundColor: meta?.color ?? "#666" }}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                            style={{
                              backgroundColor: meta?.color ?? "#666",
                            }}
                          >
                            {meta?.label ?? pr.event}
                          </span>
                          <span className="text-xs text-muted">
                            {pr.implement}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--muted-bg)] text-muted font-medium">
                            {pr.source === "COMPETITION"
                              ? "Competition"
                              : "Training"}
                          </span>
                        </div>
                        <p className="text-xs text-surface-700 dark:text-surface-300 mt-1">
                          {fmtDateLong(pr.date)}
                        </p>
                      </div>
                      <span className="text-lg font-bold font-mono text-primary-600 dark:text-primary-300 whitespace-nowrap">
                        {pr.distance.toFixed(2)}m
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-muted">
              No personal records recorded yet.
            </p>
          </div>
        )}
      </section>

      {/* ── Section 3: Competition vs Practice ─────────────────────── */}
      <section className="card !p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
            Competition vs Practice
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Throw volume and average distance split
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Competition */}
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
                  {totalComp.avgDistance.toFixed(2)}m avg
                </p>
              </div>
            )}
            {/* Bar */}
            <div className="w-full h-2 bg-[var(--muted-bg)] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-700"
                style={{
                  width: `${(totalComp.count / maxCount) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Practice */}
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
                  {totalPract.avgDistance.toFixed(2)}m avg
                </p>
              </div>
            )}
            {/* Bar */}
            <div className="w-full h-2 bg-[var(--muted-bg)] rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-700"
                style={{
                  width: `${(totalPract.count / maxCount) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Implement Weight Distribution ───────────────── */}
      <section className="card !p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
            Implement Distribution
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Throw count and distances by implement weight
          </p>
        </div>

        {filteredImplDist.length > 0 ? (
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
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {row.implement}
                          </p>
                          <p className="text-xs text-surface-700 dark:text-surface-300">
                            {row.throwCount} throw
                            {row.throwCount !== 1 ? "s" : ""} &middot; avg{" "}
                            {row.avgDistance.toFixed(2)}m
                          </p>
                        </div>
                        <span className="text-base font-bold font-mono text-orange-600 dark:text-orange-400 whitespace-nowrap">
                          {row.bestDistance.toFixed(2)}m
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
            <p className="text-sm text-muted">
              No implement data for the selected filter.
            </p>
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
        <h1 className="text-display font-heading text-[var(--foreground)]">
          Throw Analysis
        </h1>
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
