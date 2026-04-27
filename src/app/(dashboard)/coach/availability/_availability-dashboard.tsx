"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Users,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import type { BestWindow, AthleteAvailabilitySummary } from "@/lib/data/availability";
import type { AthletePickerItem } from "@/lib/data/coach";
import { logger } from "@/lib/logger";

const EXCLUDE_INJURED_KEY = "availability:excludeInjured";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamAvailabilityData {
  athletes: AthleteAvailabilitySummary[];
  bestWindows: BestWindow[];
  totalAthletes: number;
}

interface EventGroupOption {
  id: string;
  name: string;
}

interface AvailabilityDashboardProps {
  initialData: TeamAvailabilityData;
  athletes: AthletePickerItem[];
  eventGroups: EventGroupOption[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function badgeVariantForPct(pct: number): "success" | "primary" | "warning" {
  if (pct >= 90) return "success";
  if (pct >= 70) return "primary";
  return "warning";
}

// ─── Window Card ──────────────────────────────────────────────────────────────

interface WindowCardProps {
  window: BestWindow;
  rank: number;
  allAthletes: AthleteAvailabilitySummary[];
  athleteMap: Map<string, AthletePickerItem>;
}

function WindowCard({ window: win, rank, allAthletes, athleteMap }: WindowCardProps) {
  const [expanded, setExpanded] = useState(false);
  const pct = win.percentAvailable;

  // Athletes available = in window's set (not in conflictAthletes)
  const conflictIds = new Set(win.conflictAthletes.map((c) => c.id));
  const athletesWithData = new Set(allAthletes.map((a) => a.athleteId));

  const availableAthletes = allAthletes.filter(
    (a) => a.blocks.length > 0 && !conflictIds.has(a.athleteId)
  );
  const conflictAthletes = win.conflictAthletes;
  const noDataAthletes = allAthletes.filter((a) => a.blocks.length === 0);

  // Athletes that have data but are in conflict
  const conflictWithData = conflictAthletes.filter((c) => athletesWithData.has(c.id));

  return (
    <div
      className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden"
      style={{ transition: "box-shadow 150ms ease" }}
    >
      {/* Card header — clickable */}
      <button
        className="w-full text-left px-4 py-4 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          {/* Rank badge */}
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center mt-0.5">
            <span className="text-xs font-mono font-semibold text-muted tabular-nums">{rank}</span>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {/* Day + time */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-semibold text-[var(--foreground)]">{win.dayLabel}</span>
              <span className="font-mono tabular-nums text-sm text-muted">
                {formatTime(win.startTime)} – {formatTime(win.endTime)}
              </span>
              <span className="text-xs text-muted">
                {win.durationMinutes >= 60
                  ? `${win.durationMinutes / 60}h`
                  : `${win.durationMinutes}m`}
              </span>
            </div>

            {/* Progress bar */}
            <ProgressBar
              value={pct}
              variant={pct >= 90 ? "success" : pct >= 70 ? "primary" : "warning"}
              size="sm"
            />

            {/* Count + badge */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted tabular-nums font-mono">
                <AnimatedNumber value={win.availableCount} /> / {win.totalAthletes} athletes
              </span>
              <div className="flex items-center gap-2">
                <Badge variant={badgeVariantForPct(pct)}>{pct}%</Badge>
                {expanded ? (
                  <ChevronUp className="w-4 h-4 text-muted" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <ChevronDown
                    className="w-4 h-4 text-muted"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </button>

      {/* Drill-down */}
      {expanded && (
        <div className="border-t border-[var(--card-border)] px-4 py-4 space-y-4 animate-fade-slide-in">
          {/* Available */}
          {availableAthletes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2
                  className="w-3.5 h-3.5 text-success-500 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Available ({availableAthletes.length})
                </span>
              </div>
              <div className="space-y-1">
                {availableAthletes.map((a) => {
                  const info = athleteMap.get(a.athleteId);
                  const name = info ? `${info.firstName} ${info.lastName}` : a.athleteName;
                  return (
                    <Link
                      key={a.athleteId}
                      href={`/coach/athletes/${a.athleteId}`}
                      className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors group"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-success-500 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-sm text-[var(--foreground)] group-hover:text-primary-500 transition-colors">
                        {name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conflicts */}
          {conflictWithData.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <XCircle
                  className="w-3.5 h-3.5 text-danger-500 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Conflicts ({conflictWithData.length})
                </span>
              </div>
              <div className="space-y-1">
                {conflictWithData.map((c) => {
                  const athleteData = allAthletes.find((a) => a.athleteId === c.id);
                  // Find conflict reason from blocks (unavailable blocks on same day)
                  const conflictBlock = athleteData?.blocks.find(
                    (b) => b.dayOfWeek === win.dayOfWeek && b.type !== "AVAILABLE"
                  );
                  const reason = conflictBlock?.label ?? conflictBlock?.notes ?? null;
                  return (
                    <Link
                      key={c.id}
                      href={`/coach/athletes/${c.id}`}
                      className="flex items-start gap-2 py-1 px-2 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors group"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-danger-500 shrink-0 mt-1.5"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <span className="text-sm text-[var(--foreground)] group-hover:text-primary-500 transition-colors">
                          {c.name}
                        </span>
                        {reason && <span className="text-xs text-muted ml-2">— {reason}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* No data */}
          {noDataAthletes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle
                  className="w-3.5 h-3.5 text-muted shrink-0"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  No Data ({noDataAthletes.length})
                </span>
              </div>
              <div className="space-y-1">
                {noDataAthletes.map((a) => {
                  const info = athleteMap.get(a.athleteId);
                  const name = info ? `${info.firstName} ${info.lastName}` : a.athleteName;
                  return (
                    <Link
                      key={a.athleteId}
                      href={`/coach/athletes/${a.athleteId}`}
                      className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors group"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-surface-400 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-sm text-muted group-hover:text-primary-500 transition-colors">
                        {name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function AvailabilityDashboard({
  initialData,
  athletes,
  eventGroups,
}: AvailabilityDashboardProps) {
  const [data, setData] = useState<TeamAvailabilityData>(initialData);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [excludeInjured, setExcludeInjured] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(EXCLUDE_INJURED_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Build an id → AthletePickerItem map for fast name lookups
  const athleteMap = new Map<string, AthletePickerItem>(athletes.map((a) => [a.id, a]));

  const athletesWithAvailability = data.athletes.filter((a) => a.blocks.length > 0).length;
  const athletesWithout = data.totalAthletes - athletesWithAvailability;
  const missingAthletes = data.athletes.filter((a) => a.blocks.length === 0);

  async function fetchData(groupId: string, injured: boolean) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (groupId) params.set("groupId", groupId);
      if (injured) params.set("excludeInjured", "true");
      const url = params.toString()
        ? `/api/coach/availability?${params.toString()}`
        : "/api/coach/availability";
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json.data as TeamAvailabilityData);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGroupChange(groupId: string) {
    setSelectedGroupId(groupId);
    await fetchData(groupId, excludeInjured);
  }

  async function handleExcludeInjuredChange(next: boolean) {
    setExcludeInjured(next);
    try {
      localStorage.setItem(EXCLUDE_INJURED_KEY, String(next));
    } catch (err) {
      // localStorage blocked (private browsing etc.) — silently ignore
      logger.debug("localStorage blocked (private browsing etc.) — silently ignore", {
        context: "src/app/(dashboard)/coach/availability/_availability-dashboard.tsx",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }
    await fetchData(selectedGroupId, next);
  }

  const hasAnyData = data.athletes.some((a) => a.blocks.length > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ScrollProgressBar />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Team Availability
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Best practice time windows based on athlete schedules
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Exclude injured toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={excludeInjured}
              aria-label="Exclude injured athletes"
              disabled={loading}
              onClick={() => handleExcludeInjuredChange(!excludeInjured)}
              className={[
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60",
                "disabled:opacity-50",
                excludeInjured ? "bg-primary-500" : "bg-surface-300 dark:bg-surface-600",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200",
                  excludeInjured ? "translate-x-4.5" : "translate-x-0.5",
                ].join(" ")}
              />
            </button>
            <span className="text-sm text-muted whitespace-nowrap">Exclude injured</span>
          </label>

          {/* Event group filter */}
          {eventGroups.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="group-filter" className="text-sm text-muted whitespace-nowrap">
                Group
              </label>
              <select
                id="group-filter"
                value={selectedGroupId}
                onChange={(e) => handleGroupChange(e.target.value)}
                disabled={loading}
                className="text-sm rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:opacity-50 transition-opacity"
              >
                <option value="">All Athletes</option>
                {eventGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Total Athletes */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Users className="w-4 h-4 text-muted" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[var(--foreground)]">
            <AnimatedNumber value={data.totalAthletes} />
          </div>
          <p className="text-xs text-muted uppercase tracking-wider font-semibold mt-1">Total</p>
        </div>

        {/* Submitted */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <ClipboardList
              className="w-4 h-4 text-success-500"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-success-500">
            <AnimatedNumber value={athletesWithAvailability} />
          </div>
          <p className="text-xs text-muted uppercase tracking-wider font-semibold mt-1">
            Submitted
          </p>
        </div>

        {/* Missing */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <AlertCircle
              className={`w-4 h-4 ${athletesWithout > 0 ? "text-warning-500" : "text-muted"}`}
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums ${athletesWithout > 0 ? "text-warning-500" : "text-muted"}`}
          >
            <AnimatedNumber value={athletesWithout} />
          </div>
          <p className="text-xs text-muted uppercase tracking-wider font-semibold mt-1">Missing</p>
        </div>
      </div>

      {/* Missing athletes alert */}
      {missingAthletes.length > 0 && (
        <div className="rounded-xl border border-warning-500/30 bg-warning-500/8 px-4 py-4">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="w-4 h-4 text-warning-500 shrink-0 mt-0.5"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-warning-700 dark:text-warning-400">
                {missingAthletes.length}{" "}
                {missingAthletes.length === 1 ? "athlete hasn't" : "athletes haven't"} submitted
                their availability yet
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {missingAthletes.map((a) => {
                  const info = athleteMap.get(a.athleteId);
                  const name = info ? `${info.firstName} ${info.lastName}` : a.athleteName;
                  return (
                    <Link
                      key={a.athleteId}
                      href={`/coach/athletes/${a.athleteId}`}
                      className="text-sm text-warning-600 dark:text-warning-400 hover:underline"
                    >
                      {name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Best Windows section */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          Best Practice Windows
        </h2>

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] h-24 shimmer"
              />
            ))}
          </div>
        )}

        {!loading && !hasAnyData && (
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
            <EmptyState
              icon={<Calendar size={32} strokeWidth={1.75} aria-hidden="true" />}
              title="No availability data yet"
              description="Athletes can submit their schedules from their Availability page. Once submitted, best practice windows will appear here."
            />
          </div>
        )}

        {!loading && hasAnyData && data.bestWindows.length === 0 && (
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
            <EmptyState
              icon={<Calendar size={32} strokeWidth={1.75} aria-hidden="true" />}
              title="No overlapping windows found"
              description="No time slots have 50% or more athletes available simultaneously. Ask athletes to review their schedules."
            />
          </div>
        )}

        {!loading && data.bestWindows.length > 0 && (
          <StaggeredList className="space-y-3">
            {data.bestWindows.map((win, i) => (
              <WindowCard
                key={`${win.dayOfWeek}-${win.startTime}-${win.endTime}`}
                window={win}
                rank={i + 1}
                allAthletes={data.athletes}
                athleteMap={athleteMap}
              />
            ))}
          </StaggeredList>
        )}
      </div>
    </div>
  );
}
