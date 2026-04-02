"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  LineChart,
  type LineChartSeries,
  type PointHoverInfo,
} from "@/components/charts/LineChart";
import { EVENTS, type ThrowEvent } from "@/lib/throws/constants";
import { formatImplementWeight } from "@/lib/throws";
import type { ThrowLogItem } from "@/lib/data/coach";

/* ─── Constants ─────────────────────────────────────────────────────────── */

const DATE_RANGES = [
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
  { label: "Season", days: 0 }, // 0 = all
] as const;

function formatEventLabel(event: string): string {
  return EVENTS[event as ThrowEvent]?.label ?? event;
}

function eventColor(event: string): string {
  return EVENTS[event as ThrowEvent]?.color ?? "#888";
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTooltipDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ─── Data Processing ───────────────────────────────────────────────────── */

interface ChartPoint {
  date: string;      // ISO date string (day precision)
  dateLabel: string;  // "Mar 12"
  event: string;
  distance: number;
  implementWeight: number;
  isPersonalBest: boolean;
}

/** Groups throws by date+event, taking best distance per group. Sorts chronologically. */
function processThrows(
  throws: ThrowLogItem[],
  selectedEvents: Set<string>,
  rangeDays: number
): { points: ChartPoint[]; eventKeys: string[] } {
  const now = new Date();
  const cutoff = rangeDays > 0
    ? new Date(now.getTime() - rangeDays * 86_400_000)
    : null;

  // Filter and group by date+event (best distance per day per event)
  const grouped = new Map<string, ChartPoint>();

  for (const t of throws) {
    if (!selectedEvents.has(t.event)) continue;
    const throwDate = new Date(t.date);
    if (cutoff && throwDate < cutoff) continue;

    const dayKey = t.date.slice(0, 10); // YYYY-MM-DD
    const key = `${dayKey}|${t.event}`;
    const existing = grouped.get(key);

    if (!existing || t.distance > existing.distance) {
      grouped.set(key, {
        date: dayKey,
        dateLabel: formatDateLabel(t.date),
        event: t.event,
        distance: t.distance,
        implementWeight: t.implementWeight,
        isPersonalBest: t.isPersonalBest || (existing?.isPersonalBest ?? false),
      });
    }
  }

  const points = [...grouped.values()].sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  const eventKeys = [...new Set(points.map((p) => p.event))].sort();

  return { points, eventKeys };
}

/** Build LineChartSeries[] and a parallel PR lookup from processed points */
function buildSeries(
  points: ChartPoint[],
  eventKeys: string[]
): {
  series: LineChartSeries[];
  prLookup: Map<string, boolean>; // "seriesIdx-pointIdx" → true
} {
  const prLookup = new Map<string, boolean>();
  const series: LineChartSeries[] = eventKeys.map((event, si) => {
    const eventPoints = points.filter((p) => p.event === event);

    // Build data array with one entry per date this event has data
    const data = eventPoints.map((p, pi) => {
      if (p.isPersonalBest) prLookup.set(`${si}-${pi}`, true);
      return { label: p.dateLabel, value: p.distance };
    });

    return {
      data,
      color: eventColor(event),
      label: formatEventLabel(event),
    };
  });

  return { series, prLookup };
}

/* ─── Tooltip Meta (parallel to series data) ────────────────────────────── */

function buildTooltipMeta(
  points: ChartPoint[],
  eventKeys: string[]
): Map<string, ChartPoint> {
  const meta = new Map<string, ChartPoint>();
  eventKeys.forEach((event, si) => {
    const eventPoints = points.filter((p) => p.event === event);
    eventPoints.forEach((p, pi) => {
      meta.set(`${si}-${pi}`, p);
    });
  });
  return meta;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function DistanceTrend({ throws }: { throws: ThrowLogItem[] }) {
  const [rangeDays, setRangeDays] = useState(90);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(() => {
    const present = new Set(throws.map((t) => t.event));
    return present;
  });
  const [hovered, setHovered] = useState<{
    info: PointHoverInfo;
    meta: ChartPoint;
    mouseX: number;
    mouseY: number;
  } | null>(null);

  const chartRef = useRef<HTMLDivElement>(null);

  // Toggle event filter
  const toggleEvent = useCallback((event: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) {
        if (next.size > 1) next.delete(event); // keep at least one
      } else {
        next.add(event);
      }
      return next;
    });
  }, []);

  // Process data
  const { points, eventKeys } = useMemo(
    () => processThrows(throws, selectedEvents, rangeDays),
    [throws, selectedEvents, rangeDays]
  );

  const { series, prLookup } = useMemo(
    () => buildSeries(points, eventKeys),
    [points, eventKeys]
  );

  const tooltipMeta = useMemo(
    () => buildTooltipMeta(points, eventKeys),
    [points, eventKeys]
  );

  // Events that exist in the data (for filter pills)
  const availableEvents = useMemo(
    () => [...new Set(throws.map((t) => t.event))].sort(),
    [throws]
  );

  // Hover handlers
  const handlePointHover = useCallback(
    (info: PointHoverInfo, event: React.MouseEvent) => {
      const meta = tooltipMeta.get(`${info.seriesIndex}-${info.pointIndex}`);
      if (!meta) return;
      const rect = chartRef.current?.getBoundingClientRect();
      if (!rect) return;
      setHovered({
        info,
        meta,
        mouseX: event.clientX - rect.left,
        mouseY: event.clientY - rect.top,
      });
    },
    [tooltipMeta]
  );

  const handlePointLeave = useCallback(() => setHovered(null), []);

  // PR star marker renderer
  const renderDot = useCallback(
    (info: PointHoverInfo) => {
      const isPR = prLookup.has(`${info.seriesIndex}-${info.pointIndex}`);
      if (isPR) {
        // Star marker for PRs
        return (
          <g>
            <circle
              cx={info.svgX}
              cy={info.svgY}
              r="5"
              fill={info.color}
              stroke="var(--card-bg)"
              strokeWidth="2"
            />
            {/* Diamond overlay */}
            <polygon
              points={`${info.svgX},${info.svgY - 7} ${info.svgX + 4},${info.svgY} ${info.svgX},${info.svgY + 7} ${info.svgX - 4},${info.svgY}`}
              fill="#FFC800"
              stroke="var(--card-bg)"
              strokeWidth="1"
              opacity="0.9"
            />
          </g>
        );
      }
      // Default dot
      return (
        <circle
          cx={info.svgX}
          cy={info.svgY}
          r="3"
          fill="var(--card-bg)"
          stroke={info.color}
          strokeWidth="2"
        />
      );
    },
    [prLookup]
  );

  // Empty state
  if (throws.length === 0) {
    return (
      <div className="card px-6 py-10 text-center">
        <p className="text-sm text-muted">
          Log throws to see distance trends
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row: title + date range selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Distance Trend
        </h3>
        <div className="inline-flex w-full sm:w-auto rounded-lg bg-surface-100 dark:bg-surface-800 p-0.5">
          {DATE_RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRangeDays(r.days)}
              className={cn(
                "flex-1 sm:flex-none px-3 py-1.5 sm:py-1 rounded-md text-xs font-medium transition-colors tabular-nums",
                rangeDays === r.days
                  ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
                  : "text-muted hover:text-[var(--foreground)]"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event filter pills */}
      <div className="flex flex-wrap gap-2">
        {availableEvents.map((event) => {
          const active = selectedEvents.has(event);
          const col = eventColor(event);
          return (
            <button
              key={event}
              onClick={() => toggleEvent(event)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all",
                active
                  ? "text-white shadow-sm"
                  : "text-muted bg-surface-100 dark:bg-surface-800 hover:text-[var(--foreground)]"
              )}
              style={active ? { backgroundColor: col } : undefined}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: col, opacity: active ? 1 : 0.4 }}
              />
              {formatEventLabel(event)}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      {points.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <p className="text-sm text-muted">
            No throws in the selected range
          </p>
        </div>
      ) : (
        <div className="card p-4 relative" ref={chartRef}>
          <LineChart
            series={series}
            height={260}
            showArea={false}
            showDots={true}
            gridLines={4}
            formatY={(v) => `${v.toFixed(1)}m`}
            renderDot={renderDot}
            onPointHover={handlePointHover}
            onPointLeave={handlePointLeave}
          />

          {/* Tooltip */}
          {hovered && (
            <div
              className="absolute z-50 pointer-events-none"
              style={{
                left: Math.min(
                  hovered.mouseX + 12,
                  (chartRef.current?.offsetWidth ?? 300) - 180
                ),
                top: Math.max(hovered.mouseY - 60, 4),
              }}
            >
              <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-lg px-3 py-2 text-xs space-y-0.5 min-w-[140px]">
                <p className="font-semibold text-[var(--foreground)]">
                  {formatTooltipDate(hovered.meta.date)}
                </p>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: hovered.info.color }}
                  />
                  <span className="text-muted">
                    {formatEventLabel(hovered.meta.event)}
                  </span>
                </div>
                <p className="font-mono tabular-nums text-[var(--foreground)] text-sm font-bold">
                  {hovered.meta.distance.toFixed(2)}m
                </p>
                <p className="text-muted">
                  {formatImplementWeight(hovered.meta.implementWeight)}
                </p>
                {hovered.meta.isPersonalBest && (
                  <p className="text-amber-500 font-semibold">
                    ◆ Personal Record
                  </p>
                )}
              </div>
            </div>
          )}

          {/* PR legend */}
          {prLookup.size > 0 && (
            <div className="flex items-center gap-1.5 mt-2 ml-1">
              <span className="text-amber-500 text-xs">◆</span>
              <span className="text-[11px] text-muted">Personal Record</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
