"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import type { HistoryDay, HistoryFilter, HistoryResponse } from "@/lib/throws/history-types";
import { Skeleton, SkeletonLine } from "@/components/ui/Skeleton";
import { HistoryDayCard } from "./_history-day-card";
import { HistoryFilterChips } from "./_history-filter-chips";
import { HistoryFilterSheet, type FilterVariant } from "./_history-filter-sheet";
import { HistoryWeekDivider } from "./_history-week-divider";
import { HistoryEmptyState } from "./_history-empty-state";
import { HistoryFiltersEmptyState } from "./_history-filters-empty-state";
import { HistoryErrorState } from "./_history-error-state";

const DEFAULT_FILTER: HistoryFilter = {
  range: "30d",
  start: null,
  end: null,
  events: [],
  implementsKg: [],
  prOnly: false,
};

function hasAnyActive(f: HistoryFilter): boolean {
  return (
    f.range !== "30d" ||
    f.events.length > 0 ||
    f.implementsKg.length > 0 ||
    f.prOnly
  );
}

function filterToQueryString(f: HistoryFilter): string {
  const params = new URLSearchParams();
  params.set("range", f.range);
  if (f.range === "custom") {
    if (f.start) params.set("start", f.start);
    if (f.end) params.set("end", f.end);
  }
  if (f.events.length > 0) params.set("events", f.events.join(","));
  if (f.implementsKg.length > 0) params.set("implements", f.implementsKg.join(","));
  if (f.prOnly) params.set("prOnly", "true");
  return params.toString();
}

// Group days into weeks for rendering dividers between them.
function weekKey(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  const monday = new Date(d);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function weekLabel(mondayIso: string): string {
  const d = new Date(`${mondayIso}T12:00:00`);
  const month = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
  return `Week of ${month} ${d.getDate()}`;
}

export function HistoryClient() {
  const { error: toastError } = useToast();
  const [filter, setFilter] = useState<HistoryFilter>(DEFAULT_FILTER);
  const [days, setDays] = useState<HistoryDay[]>([]);
  const [totals, setTotals] = useState<{ sessions: number; throws: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sheetVariant, setSheetVariant] = useState<FilterVariant | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchHistory = useCallback(async (f: HistoryFilter, cursor?: string) => {
    // Cancel any in-flight fetch from a previous filter so an older slow
    // response can't overwrite a newer one. Don't cancel for load-more
    // fetches (those use their own flag).
    if (!cursor) {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
    }

    if (!cursor) {
      setStatus("loading");
      setErrorMsg("");
    } else {
      setLoadingMore(true);
    }

    try {
      const qs = filterToQueryString(f) + (cursor ? `&cursor=${cursor}` : "");
      const res = await fetch(`/api/throws/history?${qs}`, {
        signal: cursor ? undefined : abortRef.current?.signal,
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        const msg = payload.error || `Request failed (${res.status})`;
        if (!cursor) {
          setErrorMsg(msg);
          setStatus("error");
        }
        toastError(msg);
        return;
      }
      const data = payload.data as HistoryResponse;
      if (cursor) {
        // Append to existing days
        setDays((prev) => [...prev, ...data.days]);
      } else {
        // First page: replace
        setDays(data.days);
        if (data.totals) setTotals(data.totals);
      }
      setNextCursor(data.nextCursor);
      if (!cursor) setStatus("ready");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Network error";
      if (!cursor) {
        setErrorMsg(msg);
        setStatus("error");
      }
      toastError(msg);
    } finally {
      if (cursor) setLoadingMore(false);
    }
  }, [toastError]);

  // Cancel the in-flight fetch on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Reset and fetch when filter changes.
  useEffect(() => {
    setDays([]);
    setNextCursor(null);
    setTotals(null);
    fetchHistory(filter);
  }, [filter, fetchHistory]);

  // Infinite scroll: observe a sentinel div near the bottom of the list.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !loadingMore && status === "ready") {
          fetchHistory(filter, nextCursor);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, loadingMore, status, filter, fetchHistory]);

  const handleClearFilters = () => setFilter(DEFAULT_FILTER);

  // Group days by week for divider rendering
  const weekGroups: { weekStart: string; days: HistoryDay[] }[] = [];
  for (const d of days) {
    const ws = weekKey(d.date);
    const last = weekGroups[weekGroups.length - 1];
    if (last && last.weekStart === ws) {
      last.days.push(d);
    } else {
      weekGroups.push({ weekStart: ws, days: [d] });
    }
  }

  const filtersActive = hasAnyActive(filter);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div>
        <h1 className="text-display font-heading text-[var(--foreground)]">History</h1>
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Everything you&rsquo;ve thrown
        </p>
      </div>

      {/* Filter chips */}
      <HistoryFilterChips
        filter={filter}
        onOpen={(v) => setSheetVariant(v)}
        onClear={handleClearFilters}
        hasAnyActive={filtersActive}
      />

      {/* Summary line */}
      {status === "ready" && totals && (
        <div className="text-xs text-muted uppercase tracking-wider">
          <span className="font-mono tabular-nums text-[var(--foreground)]">{totals.sessions}</span> sessions · <span className="font-mono tabular-nums text-[var(--foreground)]">{totals.throws}</span> throws
        </div>
      )}

      {/* Body */}
      {status === "loading" && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-2">
              <SkeletonLine className="w-16 h-3" />
              <SkeletonLine className="w-24 h-5" />
              <Skeleton className="w-full h-4 rounded" />
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <HistoryErrorState
          message={errorMsg}
          onRetry={() => fetchHistory(filter)}
        />
      )}

      {status === "ready" && days.length === 0 && !filtersActive && <HistoryEmptyState />}
      {status === "ready" && days.length === 0 && filtersActive && (
        <HistoryFiltersEmptyState onClear={handleClearFilters} />
      )}

      {status === "ready" && days.length > 0 && (
        <div className="space-y-2">
          {weekGroups.map((group, gi) => (
            <div key={group.weekStart}>
              {gi > 0 && <HistoryWeekDivider label={weekLabel(group.weekStart)} />}
              {group.days.map((day) => (
                <div key={day.date} className="mb-2">
                  <HistoryDayCard day={day} />
                </div>
              ))}
            </div>
          ))}

          {/* Loading more spinner */}
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Infinite scroll sentinel — observed by IntersectionObserver */}
          {nextCursor && !loadingMore && (
            <div ref={sentinelRef} className="h-1" aria-hidden="true" />
          )}
        </div>
      )}

      {/* Filter sheets — one generic component with variants */}
      <HistoryFilterSheet
        open={sheetVariant !== null}
        variant={sheetVariant ?? "range"}
        onClose={() => setSheetVariant(null)}
      >
        {sheetVariant === "range" && (
          <FilterRangeSheetBody
            value={filter.range}
            onChange={(range) => {
              setFilter((f) => ({ ...f, range }));
              setSheetVariant(null);
            }}
          />
        )}
        {sheetVariant === "event" && (
          <FilterEventSheetBody
            value={filter.events}
            onChange={(events) => {
              setFilter((f) => ({ ...f, events }));
              setSheetVariant(null);
            }}
          />
        )}
        {sheetVariant === "implement" && (
          <FilterImplementSheetBody
            days={days}
            value={filter.implementsKg}
            onChange={(implementsKg) => {
              setFilter((f) => ({ ...f, implementsKg }));
              setSheetVariant(null);
            }}
          />
        )}
        {sheetVariant === "pr" && (
          <FilterPrSheetBody
            value={filter.prOnly}
            onChange={(prOnly) => {
              setFilter((f) => ({ ...f, prOnly }));
              setSheetVariant(null);
            }}
          />
        )}
      </HistoryFilterSheet>
    </div>
  );
}

// ── Inline sheet body components ──

function FilterRangeSheetBody({
  value,
  onChange,
}: {
  value: HistoryFilter["range"];
  onChange: (v: HistoryFilter["range"]) => void;
}) {
  const options: { v: HistoryFilter["range"]; label: string }[] = [
    { v: "7d", label: "Last 7 days" },
    { v: "30d", label: "Last 30 days" },
    { v: "90d", label: "Last 90 days" },
    { v: "ytd", label: "Year to date" },
    { v: "all", label: "All time" },
  ];
  return (
    <ul className="space-y-1">
      {options.map((opt) => (
        <li key={opt.v}>
          <button
            type="button"
            onClick={() => onChange(opt.v)}
            className={`w-full text-left px-3 py-3 rounded-lg ${
              value === opt.v
                ? "bg-primary-500/15 text-primary-500"
                : "hover:bg-surface-100 dark:hover:bg-surface-800 text-[var(--foreground)]"
            }`}
          >
            {opt.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function FilterEventSheetBody({
  value,
  onChange,
}: {
  value: HistoryFilter["events"];
  onChange: (v: HistoryFilter["events"]) => void;
}) {
  const options: { v: HistoryFilter["events"][number]; label: string }[] = [
    { v: "SHOT_PUT", label: "Shot Put" },
    { v: "DISCUS", label: "Discus" },
    { v: "HAMMER", label: "Hammer" },
    { v: "JAVELIN", label: "Javelin" },
  ];
  const toggle = (ev: HistoryFilter["events"][number]) => {
    onChange(value.includes(ev) ? value.filter((e) => e !== ev) : [...value, ev]);
  };
  return (
    <ul className="space-y-1">
      {options.map((opt) => {
        const on = value.includes(opt.v);
        return (
          <li key={opt.v}>
            <button
              type="button"
              onClick={() => toggle(opt.v)}
              className={`w-full text-left px-3 py-3 rounded-lg flex items-center justify-between ${
                on
                  ? "bg-primary-500/15 text-primary-500"
                  : "hover:bg-surface-100 dark:hover:bg-surface-800 text-[var(--foreground)]"
              }`}
            >
              <span>{opt.label}</span>
              {on && <span aria-hidden="true">✓</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function FilterImplementSheetBody({
  days,
  value,
  onChange,
}: {
  days: HistoryDay[];
  value: number[];
  onChange: (v: number[]) => void;
}) {
  // Derive available implements from the currently-loaded days (contextual filter).
  const available = Array.from(
    new Set(days.flatMap((d) => d.drills.map((dr) => dr.implementKg)))
  ).sort((a, b) => b - a);

  if (available.length === 0) {
    return <p className="text-sm text-muted py-4">No implements in current range.</p>;
  }

  const toggle = (kg: number) => {
    onChange(value.includes(kg) ? value.filter((k) => k !== kg) : [...value, kg]);
  };

  return (
    <ul className="space-y-1">
      {available.map((kg) => {
        const on = value.includes(kg);
        return (
          <li key={kg}>
            <button
              type="button"
              onClick={() => toggle(kg)}
              className={`w-full text-left px-3 py-3 rounded-lg flex items-center justify-between ${
                on
                  ? "bg-primary-500/15 text-primary-500"
                  : "hover:bg-surface-100 dark:hover:bg-surface-800 text-[var(--foreground)]"
              }`}
            >
              <span><span className="font-mono tabular-nums">{kg}</span>kg</span>
              {on && <span aria-hidden="true">✓</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function FilterPrSheetBody({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`w-full text-left px-3 py-3 rounded-lg ${
          !value ? "bg-primary-500/15 text-primary-500" : "hover:bg-surface-100 dark:hover:bg-surface-800"
        }`}
      >
        All throws
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`w-full text-left px-3 py-3 rounded-lg ${
          value ? "bg-primary-500/15 text-primary-500" : "hover:bg-surface-100 dark:hover:bg-surface-800"
        }`}
      >
        ★ Personal bests only
      </button>
    </div>
  );
}
