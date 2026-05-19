"use client";

import { useState, useMemo, Fragment } from "react";
import Link from "next/link";
import UserAvatar from "@/components/user-avatar";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useUrlStateMany } from "@/lib/hooks/useUrlState";
import {
  EVENTS,
  PHASE_CONFIGS,
  PHASE_RATIOS,
  PHASE_IMPLEMENT_DIST,
  WEEKLY_SCHEDULES,
  TAPER_PROTOCOL,
  CLASSIFICATIONS,
  parseEvents,
  type ThrowEvent,
  type TrainingPhase,
  type EventCode,
  CODE_EVENT_MAP,
} from "@/lib/throws/constants";
import {
  EVENT_COLORS,
  EVENT_COLOR_FALLBACK,
  EVENT_LABELS_SHORT,
  PHASE_COLORS as PHASE_COLOR_TOKENS,
  PHASE_LABELS_SHORT,
  IMPLEMENT_TIER_COLORS,
  PRIMARY_AMBER,
  MUTED_NEUTRAL,
  MUTED_NEUTRAL_DARK,
  wellnessTierColor,
  wellnessTierColorForPct,
} from "@/lib/throws/colors";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ThrowsSessionSummary {
  id: string;
  name: string;
  event: string;
  sessionType: string;
  targetPhase: string | null;
  // Prisma DateTime. The view never renders this field directly, but typing it
  // as Date keeps the Server→Client prop contract honest (previously a double
  // `as unknown as` cast hid the string↔Date mismatch).
  createdAt: Date;
  blocks: { id: string; blockType: string; config: string }[];
  assignments: {
    id: string;
    assignedDate: string;
    status: string;
    athlete: { user: { email: string } };
  }[];
}

export type PulseRow = {
  id: string;
  athleteId: string;
  event: string;
  gender: string;
  deficitPrimary: string | null;
  deficitStatus: string | null;
  overPowered: boolean;
  competitionPb: number | null;
  trainingPhase: string | null;
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
    throwsPRs: { event: string; implement: string; distance: number }[];
  };
  testingRecords: { testDate: string; testType: string }[];
  testStatus: "never" | "overdue" | "due-soon" | "ok";
  daysSinceTest: number | null;
  throwsThisWeek: number;
  implementSplit: { heavy: number; competition: number; light: number };
  daysSincePractice: number | null;
  lastPracticeDate: string | null;
  latestCheckIn: {
    date: string;
    selfFeeling: number;
    // Prisma ThrowsCheckIn.energy is Int? — can be null when the athlete
    // skipped the energy question. Render-guard it like sorenessGeneral.
    energy: number | null;
    sorenessGeneral: number | null;
  } | null;
  recentBestMark: { distance: number; date: string } | null;
};

type SortKey = "urgency" | "name" | "event" | "throws" | "days";

// ─── Constants ──────────────────────────────────────────────────────────────
// Color tokens moved to `src/lib/throws/colors.ts`. Reference EVENT_COLORS,
// PHASE_COLOR_TOKENS, IMPLEMENT_TIER_COLORS — never inline a hex here.
const EVENT_COLORS_MAP = EVENT_COLORS;
const EVENT_LABELS_MAP = EVENT_LABELS_SHORT;
const PHASE_COLORS = PHASE_COLOR_TOKENS;
const PHASE_SHORT = PHASE_LABELS_SHORT;

const TEST_STATUS_CONFIG: Record<
  PulseRow["testStatus"],
  { label: string; bg: string; text: string }
> = {
  never: {
    label: "Never",
    bg: "bg-danger-50 dark:bg-danger-900/20",
    text: "text-danger-600 dark:text-danger-400",
  },
  overdue: {
    label: "Overdue",
    bg: "bg-danger-50 dark:bg-danger-900/20",
    text: "text-danger-600 dark:text-danger-400",
  },
  "due-soon": {
    label: "Due Soon",
    bg: "bg-primary-50 dark:bg-primary-900/20",
    text: "text-primary-600 dark:text-primary-400",
  },
  ok: {
    label: "OK",
    bg: "bg-success-50 dark:bg-success-900/20",
    text: "text-success-600 dark:text-success-400",
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function phaseThrowsTarget(phase: string | null): number {
  if (!phase) return 40;
  const cfg = PHASE_CONFIGS.find((p) => p.phase === phase);
  return cfg ? cfg.throwsPerWeekMax : 40;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ImplementSplitBar({
  split,
}: {
  split: { heavy: number; competition: number; light: number };
}) {
  const total = split.heavy + split.competition + split.light;
  if (total === 0) {
    return <span className="text-nano text-muted">No throws logged</span>;
  }
  const heavyPct = Math.round((split.heavy / total) * 100);
  const compPct = Math.round((split.competition / total) * 100);
  const lightPct = 100 - heavyPct - compPct;
  return (
    <div className="space-y-1">
      <div className="flex h-4 rounded-full overflow-hidden">
        {heavyPct > 0 && (
          <div
            className="flex items-center justify-center text-nano font-bold text-white"
            style={{ width: `${heavyPct}%`, backgroundColor: IMPLEMENT_TIER_COLORS.heavy }}
            title={`Heavy: ${heavyPct}%`}
          >
            {heavyPct >= 20 ? `${heavyPct}%` : ""}
          </div>
        )}
        {compPct > 0 && (
          <div
            className="flex items-center justify-center text-nano font-bold text-white"
            style={{ width: `${compPct}%`, backgroundColor: IMPLEMENT_TIER_COLORS.competition }}
            title={`Comp: ${compPct}%`}
          >
            {compPct >= 20 ? `${compPct}%` : ""}
          </div>
        )}
        {lightPct > 0 && (
          <div
            className="flex items-center justify-center text-nano font-bold text-white"
            style={{ width: `${lightPct}%`, backgroundColor: IMPLEMENT_TIER_COLORS.light }}
            title={`Light: ${lightPct}%`}
          >
            {lightPct >= 20 ? `${lightPct}%` : ""}
          </div>
        )}
      </div>
      <div className="flex justify-between text-nano text-surface-700 dark:text-surface-300">
        <span>Hvy · {split.heavy}</span>
        <span>Comp · {split.competition}</span>
        <span>Lt · {split.light}</span>
      </div>
    </div>
  );
}

function WellnessBar({
  label,
  value,
  invert = false,
}: {
  label: string;
  value: number;
  invert?: boolean;
}) {
  // invert=true for soreness: high soreness = bad → short red bar
  const effectiveValue = invert ? 11 - value : value;
  const pct = ((effectiveValue - 1) / 9) * 100;
  const color = wellnessTierColor(effectiveValue);
  return (
    <div className="flex items-center gap-2">
      <span className="text-nano text-muted w-16 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-[var(--muted-bg)] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-nano font-bold text-[var(--foreground)] w-4 text-right">{value}</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ThrowsView({
  sessions,
  pulse,
}: {
  sessions: ThrowsSessionSummary[];
  pulse: PulseRow[];
}) {
  const url = useUrlStateMany();
  const [selectedPhase, setSelectedPhase] = useState<TrainingPhase>("ACCUMULATION");

  /* Pulse-table sort lives in the URL — coaches share their analysis with
     other staff, and back-button shouldn't reset which column they sorted by. */
  const sortBy = ((): SortKey => {
    const v = url.get("sort", "urgency");
    return (["urgency", "name", "event", "throws", "days"] as SortKey[]).includes(v as SortKey)
      ? (v as SortKey)
      : "urgency";
  })();
  const sortDir = ((): "asc" | "desc" => {
    const v = url.get("dir", "asc");
    return v === "desc" ? "desc" : "asc";
  })();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      url.set({ dir: sortDir === "asc" ? "desc" : "asc" });
    } else {
      url.set({ sort: key === "urgency" ? null : key, dir: null });
    }
  }

  function toggleExpand(athleteId: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(athleteId)) next.delete(athleteId);
      else next.add(athleteId);
      return next;
    });
  }

  /* DataTable columns for the desktop pulse table. Defined here (closure
     over render state) and memoized to keep the column array identity
     stable across re-renders. */
  const pulseColumns = useMemo<Column<PulseRow>[]>(
    () => [
      {
        key: "name",
        header: "Athlete",
        sortable: true,
        className: "px-4 w-44",
        sortValue: (row) => `${row.athlete.firstName} ${row.athlete.lastName}`.toLowerCase(),
        cell: (row) => (
          <div className="flex items-center gap-2">
            <UserAvatar
              src={row.athlete.avatarUrl}
              firstName={row.athlete.firstName}
              lastName={row.athlete.lastName}
              size="sm"
            />
            <span className="text-xs font-semibold text-[var(--foreground)] truncate max-w-[80px]">
              {row.athlete.firstName} {row.athlete.lastName}
            </span>
          </div>
        ),
      },
      {
        key: "event",
        header: "Event",
        sortable: true,
        sortValue: (row) => row.event,
        cell: (row) => {
          const eventColor = EVENT_COLORS_MAP[row.event] ?? EVENT_COLOR_FALLBACK;
          const eventLabel = EVENT_LABELS_MAP[row.event] ?? row.event;
          return (
            <span
              className="text-nano font-bold px-1.5 py-0.5 rounded-full text-white whitespace-nowrap"
              style={{ backgroundColor: eventColor }}
            >
              {eventLabel} {row.gender === "M" ? "♂" : "♀"}
            </span>
          );
        },
      },
      {
        key: "deficit",
        header: "Deficit",
        cell: (row) =>
          row.deficitPrimary && row.deficitPrimary !== "none" ? (
            <span className="text-nano text-surface-700 dark:text-surface-300 max-w-[72px] truncate block">
              {row.deficitPrimary}
            </span>
          ) : row.overPowered ? (
            <span className="text-nano font-semibold text-primary-600 dark:text-primary-400">
              OverPwrd
            </span>
          ) : (
            <span className="text-nano text-muted">—</span>
          ),
      },
      {
        key: "trainingPhase",
        header: "Phase",
        cell: (row) =>
          row.trainingPhase ? (
            <span
              className="text-nano font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
              style={{
                color: PHASE_COLORS[row.trainingPhase as TrainingPhase] ?? MUTED_NEUTRAL,
                backgroundColor: `${
                  PHASE_COLORS[row.trainingPhase as TrainingPhase] ?? MUTED_NEUTRAL
                }20`,
              }}
            >
              {PHASE_SHORT[row.trainingPhase] ?? row.trainingPhase.slice(0, 5)}
            </span>
          ) : (
            <span className="text-nano text-muted">—</span>
          ),
      },
      {
        key: "urgency",
        header: "Test",
        sortable: true,
        sortValue: (row) =>
          (
            ({ never: 0, overdue: 1, "due-soon": 2, ok: 3 }) as Record<
              PulseRow["testStatus"],
              number
            >
          )[row.testStatus],
        cell: (row) => {
          const testCfg = TEST_STATUS_CONFIG[row.testStatus];
          return (
            <span
              className={`text-nano font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${testCfg.bg} ${testCfg.text}`}
            >
              {row.testStatus === "overdue" && row.daysSinceTest != null
                ? `${row.daysSinceTest}d ago`
                : row.testStatus === "due-soon" && row.daysSinceTest != null
                  ? `${row.daysSinceTest}d ago`
                  : testCfg.label}
            </span>
          );
        },
      },
      {
        key: "throws",
        header: "Throws/Wk",
        sortable: true,
        className: "w-36",
        sortValue: (row) => row.throwsThisWeek,
        cell: (row) => {
          const target = phaseThrowsTarget(row.trainingPhase);
          const throwsPct = Math.min(100, (row.throwsThisWeek / target) * 100);
          const throwsColor = wellnessTierColorForPct(throwsPct);
          return (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[var(--foreground)] w-6 text-right tabular-nums">
                {row.throwsThisWeek}
              </span>
              <div className="w-14 h-1.5 bg-[var(--muted-bg)] rounded-full overflow-hidden flex-shrink-0">
                <div
                  className="h-full rounded-full transition-colors"
                  style={{ width: `${throwsPct}%`, backgroundColor: throwsColor }}
                />
              </div>
              <span className="text-nano text-muted tabular-nums">/{target}</span>
            </div>
          );
        },
      },
      {
        key: "days",
        header: "Days Off",
        sortable: true,
        sortValue: (row) => row.daysSincePractice ?? 999,
        cell: (row) => {
          const daysClass =
            row.daysSincePractice == null
              ? "text-muted"
              : row.daysSincePractice > 5
                ? "text-danger-600 dark:text-danger-400 font-semibold"
                : row.daysSincePractice > 2
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-success-600 dark:text-success-400";
          return (
            <span className={`text-xs tabular-nums ${daysClass}`}>
              {row.daysSincePractice == null
                ? "—"
                : row.daysSincePractice === 0
                  ? "Today"
                  : `${row.daysSincePractice}d`}
            </span>
          );
        },
      },
      {
        key: "strength",
        header: "Str",
        cell: () => <span className="text-nano text-muted">—</span>,
      },
      {
        key: "recentBestMark",
        header: "Recent Mark",
        cell: (row) =>
          row.recentBestMark ? (
            <span className="text-xs font-semibold text-[var(--foreground)] tabular-nums">
              {row.recentBestMark.distance.toFixed(2)}m
            </span>
          ) : (
            <span className="text-nano text-muted">—</span>
          ),
      },
    ],
    []
  );

  /* Detail panel for an expanded pulse row. */
  const renderPulseExpanded = (row: PulseRow) => {
    const eventLong = CODE_EVENT_MAP[row.event as EventCode] ?? row.event;
    const prForEvent = row.athlete.throwsPRs?.find((pr) => pr.event === eventLong);
    const prGap =
      row.competitionPb != null && prForEvent != null
        ? row.competitionPb - prForEvent.distance
        : null;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Implement Split */}
        <div className="space-y-2">
          <p className="text-nano font-semibold uppercase tracking-wider text-muted">
            Implement Split (7d)
          </p>
          <ImplementSplitBar split={row.implementSplit} />
          {prGap != null && (
            <div className="mt-2 pt-2 border-t border-[var(--card-border)]/50">
              <p className="text-nano text-muted">Training → Comp gap</p>
              <span
                className={`text-xs font-bold tabular-nums ${
                  prGap > 2
                    ? "text-danger-600 dark:text-danger-400"
                    : prGap > 0.5
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-success-600 dark:text-success-400"
                }`}
              >
                {prGap > 0
                  ? `−${prGap.toFixed(2)}m deficit`
                  : `+${Math.abs(prGap).toFixed(2)}m above comp PB`}
              </span>
              <p className="text-nano text-muted mt-0.5 tabular-nums">
                {prForEvent?.distance.toFixed(2)}m training vs {row.competitionPb?.toFixed(2)}m comp
                PB
              </p>
            </div>
          )}
        </div>
        {/* Wellness */}
        <div className="space-y-2">
          <p className="text-nano font-semibold uppercase tracking-wider text-muted">Wellness</p>
          {row.latestCheckIn ? (
            <div className="space-y-1.5">
              <WellnessBar label="Self Feeling" value={row.latestCheckIn.selfFeeling} />
              {row.latestCheckIn.energy != null && (
                <WellnessBar label="Energy" value={row.latestCheckIn.energy} />
              )}
              {row.latestCheckIn.sorenessGeneral != null && (
                <WellnessBar label="Soreness" value={row.latestCheckIn.sorenessGeneral} invert />
              )}
              <p className="text-nano text-muted mt-0.5">
                Checked in{" "}
                {new Date(row.latestCheckIn.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          ) : (
            <p className="text-nano text-muted">No recent check-in</p>
          )}
        </div>
        {/* Quick Actions + Mark */}
        <div className="space-y-2">
          <p className="text-nano font-semibold uppercase tracking-wider text-muted">
            Quick Actions
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href={`/coach/throws/profile?athleteId=${row.athleteId}`}
              className="btn-secondary text-xs py-1.5 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              View Profile →
            </Link>
            <Link
              href={`/coach/throws/builder?athleteId=${row.athleteId}`}
              className="btn-secondary text-xs py-1.5 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              Assign Session →
            </Link>
          </div>
          {row.recentBestMark && (
            <div className="mt-1 pt-2 border-t border-[var(--card-border)]/50">
              <p className="text-nano text-muted">Recent best mark</p>
              <p className="text-sm font-bold text-[var(--foreground)] tabular-nums">
                {row.recentBestMark.distance.toFixed(2)}m
              </p>
              <p className="text-nano text-muted">
                {new Date(row.recentBestMark.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const sortedPulse = [...pulse].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "urgency") {
      const order = { never: 0, overdue: 1, "due-soon": 2, ok: 3 };
      return order[a.testStatus] - order[b.testStatus];
    }
    if (sortBy === "name") {
      return (
        dir *
        `${a.athlete.firstName} ${a.athlete.lastName}`.localeCompare(
          `${b.athlete.firstName} ${b.athlete.lastName}`
        )
      );
    }
    if (sortBy === "event") return dir * a.event.localeCompare(b.event);
    if (sortBy === "throws") return dir * (a.throwsThisWeek - b.throwsThisWeek);
    if (sortBy === "days") {
      const ad = a.daysSincePractice ?? 999;
      const bd = b.daysSincePractice ?? 999;
      return dir * (ad - bd);
    }
    return 0;
  });

  const recentSessions = sessions.slice(0, 6);
  const totalAssignments = sessions.reduce((s, ses) => s + ses.assignments.length, 0);
  const completedAssignments = sessions.reduce(
    (s, ses) => s + ses.assignments.filter((a) => a.status === "COMPLETED").length,
    0
  );
  const eventCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    for (const ev of parseEvents(s.event)) {
      acc[ev] = (acc[ev] || 0) + 1;
    }
    return acc;
  }, {});

  const phaseConfig = PHASE_CONFIGS.find((p) => p.phase === selectedPhase)!;
  const phaseRatios = PHASE_RATIOS[selectedPhase];
  const phaseDist = PHASE_IMPLEMENT_DIST.find((p) => p.phase === selectedPhase)!;
  const weeklySchedule = WEEKLY_SCHEDULES[selectedPhase];
  const needsAttention = pulse.filter(
    (p) => p.testStatus === "never" || p.testStatus === "overdue"
  ).length;

  return (
    <div className="animate-spring-up space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">Podium Throws</h1>
          <p className="text-sm text-surface-700 dark:text-surface-300">
            Bondarchuk Transfer of Training — Volume IV Programming
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <Link
            href="/coach/throws/invite"
            className="btn-secondary whitespace-nowrap flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
            Invite
          </Link>
          <Link href="/coach/athletes?tab=throws" className="btn-secondary whitespace-nowrap">
            Roster
          </Link>
          <Link href="/coach/plans/generate" className="btn-secondary whitespace-nowrap">
            Build Program
          </Link>
          <Link href="/coach/throws/builder" className="btn-primary whitespace-nowrap">
            Build Session
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/coach/throws/practice"
          className="card card-interactive !p-4 flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-success-100 dark:bg-success-900/30 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
            <svg
              className="w-5 h-5 text-success-600 dark:text-success-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">Live Practice</p>
            <p className="text-sm text-surface-700 dark:text-surface-300 truncate">
              Log attempts in real time
            </p>
          </div>
        </Link>
        <Link
          href="/coach/throws/invite"
          className="card card-interactive !p-4 flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
            <svg
              className="w-5 h-5 text-primary-600 dark:text-primary-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">
              Invite Athlete
            </p>
            <p className="text-sm text-surface-700 dark:text-surface-300 truncate">
              Generate a shareable link
            </p>
          </div>
        </Link>
        <Link
          href="/coach/athlete-preview"
          className="card card-interactive !p-4 flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
            <svg
              className="w-5 h-5 text-purple-600 dark:text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">
              View as Athlete
            </p>
            <p className="text-sm text-surface-700 dark:text-surface-300 truncate">
              Preview the athlete experience
            </p>
          </div>
        </Link>
        <Link
          href="/coach/plans/generate"
          className="card card-interactive !p-4 flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
            <svg
              className="w-5 h-5 text-primary-600 dark:text-primary-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">Build Program</p>
            <p className="text-sm text-surface-700 dark:text-surface-300 truncate">
              Generate Bondarchuk macrocycle
            </p>
          </div>
        </Link>
      </div>

      {/* ── Roster Pulse Table ────────────────────────────────────────────────── */}
      <div className="card !p-0 overflow-hidden">
        {/* Table header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Roster Pulse</h2>
            <span className="text-sm text-muted">{pulse.length} enrolled</span>
            {needsAttention > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-micro font-semibold bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {needsAttention} need testing
              </span>
            )}
          </div>
          <Link
            href="/coach/athletes?tab=throws"
            className="text-xs text-primary-600 dark:text-primary-300 font-medium flex-shrink-0 inline-flex items-center min-h-[44px]"
          >
            Full Roster →
          </Link>
        </div>

        {pulse.length === 0 ? (
          <div className="py-12 text-center px-4">
            <p className="text-sm text-surface-700 dark:text-surface-300 mb-3">
              No athletes enrolled yet.
            </p>
            <Link href="/coach/throws/invite" className="btn-primary inline-block">
              Invite Athletes
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile sort strip */}
            <div
              className="sm:hidden overflow-x-auto border-b border-[var(--card-border)]"
              style={{ scrollbarWidth: "none" }}
            >
              <div className="flex gap-1.5 px-4 py-2">
                {(["urgency", "name", "event", "throws", "days"] as SortKey[]).map((key) => {
                  const labels: Record<SortKey, string> = {
                    urgency: "Urgency",
                    name: "Name",
                    event: "Event",
                    throws: "Throws",
                    days: "Days Off",
                  };
                  const active = sortBy === key;
                  return (
                    <button
                      key={key}
                      onClick={() => toggleSort(key)}
                      className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold transition-colors ${active ? "bg-primary-600 text-white" : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300"}`}
                    >
                      {labels[key]}
                      {active && (
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          {sortDir === "asc" ? (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 15l7-7 7 7"
                            />
                          ) : (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          )}
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-[var(--card-border)]/50">
              {sortedPulse.map((row) => {
                const expanded = expandedRows.has(row.athleteId);
                const testCfg = TEST_STATUS_CONFIG[row.testStatus];
                const eventColor = EVENT_COLORS_MAP[row.event] ?? EVENT_COLOR_FALLBACK;
                const eventLabel = EVENT_LABELS_MAP[row.event] ?? row.event;
                const target = phaseThrowsTarget(row.trainingPhase);
                const throwsPct = Math.min(100, (row.throwsThisWeek / target) * 100);
                const throwsColor = wellnessTierColorForPct(throwsPct);
                const daysClass =
                  row.daysSincePractice == null
                    ? "text-muted"
                    : row.daysSincePractice > 5
                      ? "text-danger-600 dark:text-danger-400 font-semibold"
                      : row.daysSincePractice > 2
                        ? "text-primary-600 dark:text-primary-400"
                        : "text-success-600 dark:text-success-400";
                return (
                  <Fragment key={`mob-${row.id}`}>
                    <div
                      className={`px-4 py-3.5 cursor-pointer transition-colors active:bg-[var(--muted-bg)]/40 ${expanded ? "bg-[var(--muted-bg)]/20" : ""}`}
                      onClick={() => toggleExpand(row.athleteId)}
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          src={row.athlete.avatarUrl}
                          firstName={row.athlete.firstName}
                          lastName={row.athlete.lastName}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-[var(--foreground)] truncate">
                              {row.athlete.firstName} {row.athlete.lastName}
                            </span>
                            <span
                              className="text-nano font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                              style={{ backgroundColor: eventColor }}
                            >
                              {eventLabel} {row.gender === "M" ? "♂" : "♀"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span
                              className={`text-nano font-semibold px-1.5 py-0.5 rounded ${testCfg.bg} ${testCfg.text}`}
                            >
                              {row.testStatus === "overdue" && row.daysSinceTest != null
                                ? `${row.daysSinceTest}d ago`
                                : testCfg.label}
                            </span>
                            {row.trainingPhase && (
                              <span
                                className="text-nano font-semibold px-1.5 py-0.5 rounded"
                                style={{
                                  color:
                                    PHASE_COLORS[row.trainingPhase as TrainingPhase] ??
                                    MUTED_NEUTRAL,
                                  backgroundColor: `${PHASE_COLORS[row.trainingPhase as TrainingPhase] ?? MUTED_NEUTRAL}20`,
                                }}
                              >
                                {PHASE_SHORT[row.trainingPhase] ?? row.trainingPhase.slice(0, 5)}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-[var(--foreground)]">
                                {row.throwsThisWeek}
                              </span>
                              <div className="w-10 h-1.5 bg-[var(--muted-bg)] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${throwsPct}%`, backgroundColor: throwsColor }}
                                />
                              </div>
                              <span className="text-nano text-muted">/{target}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className={`text-xs ${daysClass}`}>
                            {row.daysSincePractice == null
                              ? "—"
                              : row.daysSincePractice === 0
                                ? "today"
                                : `${row.daysSincePractice}d`}
                          </span>
                          <svg
                            className={`w-4 h-4 text-muted transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                    {expanded && (
                      <div className="px-4 py-4 bg-[var(--muted-bg)]/15 border-b border-[var(--card-border)]/50 space-y-3">
                        <ImplementSplitBar split={row.implementSplit} />
                        {row.latestCheckIn && (
                          <div className="space-y-1.5">
                            <p className="text-nano font-semibold uppercase tracking-wider text-muted">
                              Wellness
                            </p>
                            <WellnessBar
                              label="Self Feeling"
                              value={row.latestCheckIn.selfFeeling}
                            />
                            {row.latestCheckIn.energy != null && (
                              <WellnessBar label="Energy" value={row.latestCheckIn.energy} />
                            )}
                            {row.latestCheckIn.sorenessGeneral != null && (
                              <WellnessBar
                                label="Soreness"
                                value={row.latestCheckIn.sorenessGeneral}
                                invert
                              />
                            )}
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <Link
                            href={`/coach/throws/profile?athleteId=${row.athleteId}`}
                            className="btn-secondary text-xs py-2.5 flex-1 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Profile →
                          </Link>
                          <Link
                            href={`/coach/throws/builder?athleteId=${row.athleteId}`}
                            className="btn-secondary text-xs py-2.5 flex-1 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Assign Session →
                          </Link>
                        </div>
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
            {/* Desktop table — DataTable with expandable rows. Expanded
                set is mirrored to `?expand=athleteId1,athleteId2` so coaches
                share a deep link with the same row(s) open. */}
            <div className="hidden sm:block">
              <DataTable<PulseRow>
                data={pulse}
                columns={pulseColumns}
                rowKey="athleteId"
                pageSize={0}
                urlStateKey=""
                defaultSort={{ key: "urgency", dir: "asc" }}
                renderExpanded={renderPulseExpanded}
                expandedUrlKey="expand"
                emptyTitle="No athletes enrolled yet"
                emptyDescription="Invite athletes to populate the pulse."
              />
            </div>
          </>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card !p-4">
          <p className="text-sm font-medium text-surface-700 dark:text-surface-300 uppercase tracking-wider">
            Sessions
          </p>
          <p className="text-2xl font-bold text-[var(--foreground)] mt-1">{sessions.length}</p>
          <p className="text-sm text-muted mt-0.5">in library</p>
        </div>
        <div className="card !p-4">
          <p className="text-sm font-medium text-surface-700 dark:text-surface-300 uppercase tracking-wider">
            Assigned
          </p>
          <p className="text-2xl font-bold text-[var(--foreground)] mt-1">{totalAssignments}</p>
          <p className="text-sm text-muted mt-0.5">total assignments</p>
        </div>
        <div className="card !p-4">
          <p className="text-sm font-medium text-surface-700 dark:text-surface-300 uppercase tracking-wider">
            Completed
          </p>
          <p className="text-2xl font-bold text-success-600 dark:text-success-400 mt-1">
            {completedAssignments}
          </p>
          <p className="text-sm text-muted mt-0.5">
            {totalAssignments > 0
              ? `${Math.round((completedAssignments / totalAssignments) * 100)}% rate`
              : "no data yet"}
          </p>
        </div>
        <div className="card !p-4">
          <p className="text-sm font-medium text-surface-700 dark:text-surface-300 uppercase tracking-wider">
            Events
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(eventCounts).map(([ev, count]) => (
              <span
                key={ev}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: EVENTS[ev as ThrowEvent]?.color || MUTED_NEUTRAL_DARK }}
              >
                {EVENTS[ev as ThrowEvent]?.label || ev} ({count})
              </span>
            ))}
            {Object.keys(eventCounts).length === 0 && (
              <span className="text-sm text-muted">No sessions yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Phase Programming */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Phase Programming</h2>
          <div className="flex gap-1">
            {(
              ["ACCUMULATION", "TRANSMUTATION", "REALIZATION", "COMPETITION"] as TrainingPhase[]
            ).map((phase) => (
              <button
                key={phase}
                onClick={() => setSelectedPhase(phase)}
                className={`px-3 py-3 rounded-full text-xs font-semibold transition-colors min-h-[44px] inline-flex items-center ${
                  selectedPhase === phase
                    ? "text-white"
                    : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300 hover:bg-[var(--muted-bg)]"
                }`}
                style={
                  selectedPhase === phase ? { backgroundColor: PHASE_COLORS[phase] } : undefined
                }
              >
                {phase.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Classification Ratios */}
          <div className="rounded-lg bg-[var(--muted-bg)]/50 p-3 space-y-2">
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
              Classification Ratios
            </p>
            <div className="space-y-1.5">
              {(["CE", "SD", "SP", "GP"] as const).map((cls) => (
                <div key={cls} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-surface-700 dark:text-surface-300 w-6">
                    {cls}
                  </span>
                  <div className="flex-1 h-3 bg-[var(--muted-bg)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-colors"
                      style={{
                        width: `${phaseRatios[cls]}%`,
                        backgroundColor: PHASE_COLORS[selectedPhase],
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold text-[var(--foreground)] w-8 text-right">
                    {phaseRatios[cls]}%
                  </span>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted mt-1">
              {CLASSIFICATIONS.CE.label} | {CLASSIFICATIONS.SD.label}
            </p>
          </div>

          {/* Weekly Parameters */}
          <div className="rounded-lg bg-[var(--muted-bg)]/50 p-3 space-y-2">
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
              Weekly Parameters
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-sm text-muted">Throws/Wk</p>
                <p className="text-sm font-bold text-[var(--foreground)]">
                  {phaseConfig.throwsPerWeekMin}–{phaseConfig.throwsPerWeekMax}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">Strength Days</p>
                <p className="text-sm font-bold text-[var(--foreground)]">
                  {phaseConfig.strengthDaysMin}–{phaseConfig.strengthDaysMax}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">Duration</p>
                <p className="text-sm font-bold text-[var(--foreground)]">
                  {phaseConfig.durationWeeksMin}–{phaseConfig.durationWeeksMax} wk
                </p>
              </div>
            </div>
          </div>

          {/* Implement Distribution */}
          <div className="rounded-lg bg-[var(--muted-bg)]/50 p-3 space-y-2">
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
              Implement Distribution
            </p>
            <div className="flex h-6 rounded-full overflow-hidden">
              <div
                className="flex items-center justify-center text-nano font-bold text-white"
                style={{
                  width: `${phaseDist.heavyPercent}%`,
                  backgroundColor: IMPLEMENT_TIER_COLORS.heavy,
                }}
                title={`Heavy: ${phaseDist.heavyPercent}%`}
              >
                {phaseDist.heavyPercent}%
              </div>
              <div
                className="flex items-center justify-center text-nano font-bold text-white"
                style={{
                  width: `${phaseDist.compPercent}%`,
                  backgroundColor: IMPLEMENT_TIER_COLORS.competition,
                }}
                title={`Comp: ${phaseDist.compPercent}%`}
              >
                {phaseDist.compPercent}%
              </div>
              <div
                className="flex items-center justify-center text-nano font-bold text-white"
                style={{
                  width: `${phaseDist.lightPercent}%`,
                  backgroundColor: IMPLEMENT_TIER_COLORS.light,
                }}
                title={`Light: ${phaseDist.lightPercent}%`}
              >
                {phaseDist.lightPercent}%
              </div>
            </div>
            <div className="flex justify-between text-nano text-surface-700 dark:text-surface-300">
              <span>Heavy</span>
              <span>Competition</span>
              <span>Light</span>
            </div>
          </div>
        </div>

        {/* Weekly Schedule */}
        <div>
          <p className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider mb-2">
            Weekly Template — {selectedPhase.charAt(0) + selectedPhase.slice(1).toLowerCase()}
          </p>
          <div className="overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {weeklySchedule.map((day) => (
                <div
                  key={day.day}
                  className="flex-shrink-0 w-28 rounded-lg border border-[var(--card-border)] p-2 space-y-1"
                  style={{ borderTopColor: PHASE_COLORS[selectedPhase], borderTopWidth: "3px" }}
                >
                  <p className="text-xs font-bold text-[var(--foreground)]">{day.day}</p>
                  <p
                    className="text-nano font-semibold"
                    style={{ color: PHASE_COLORS[selectedPhase] }}
                  >
                    Type {day.type}
                  </p>
                  <p className="text-nano text-surface-700 dark:text-surface-300">{day.focus}</p>
                  <p className="text-nano text-muted">
                    {day.throwsMin}–{day.throwsMax} throws
                  </p>
                  <p className="text-nano text-muted">Str: {day.strength}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Taper Protocol */}
      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Taper Protocol</h2>
        <div className="flex items-end gap-3 h-20">
          {TAPER_PROTOCOL.map((entry) => (
            <div key={entry.daysOut} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md transition-colors"
                style={{
                  height: `${entry.volumeMultiplier * 100}%`,
                  backgroundColor: PRIMARY_AMBER,
                  opacity: 0.3 + entry.volumeMultiplier * 0.7,
                }}
              />
              <span className="text-nano font-bold text-[var(--foreground)]">
                {Math.round(entry.volumeMultiplier * 100)}%
              </span>
              <span className="text-nano text-muted">{entry.daysOut}d out</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Sessions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Recent Sessions</h2>
          {sessions.length > 6 && (
            <Link
              href="/coach/throws/library"
              className="text-sm text-primary-600 dark:text-primary-300 font-medium"
            >
              View All
            </Link>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="card text-center py-12">
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">No sessions yet</h3>
            <p className="text-sm text-surface-700 dark:text-surface-300 mb-4">
              Build your first Bondarchuk-validated throws session to get started.
            </p>
            <Link href="/coach/throws/builder" className="btn-primary">
              Build Your First Session
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentSessions.map((session) => {
              const sessionEvents = parseEvents(session.event);
              const throwBlocks = session.blocks.filter((b) => b.blockType === "THROWING");
              const totalThrows = throwBlocks.reduce((sum, b) => {
                try {
                  return sum + (JSON.parse(b.config)?.throwCount || 0);
                } catch {
                  return sum;
                }
              }, 0);

              return (
                <div key={session.id} className="card !p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-[var(--foreground)] text-sm">
                        {session.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {sessionEvents.map((ev) => {
                          const meta = EVENTS[ev];
                          return (
                            <span
                              key={ev}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-nano font-bold text-white"
                              style={{ backgroundColor: meta?.color || MUTED_NEUTRAL_DARK }}
                            >
                              {meta?.label || ev}
                            </span>
                          );
                        })}
                        <span className="text-xs text-muted">
                          {session.sessionType.replace(/_/g, " ")}
                        </span>
                        {session.targetPhase && (
                          <span
                            className="text-nano font-semibold px-1.5 py-0.5 rounded"
                            style={{
                              color:
                                PHASE_COLORS[session.targetPhase as TrainingPhase] ||
                                MUTED_NEUTRAL_DARK,
                              backgroundColor: `${PHASE_COLORS[session.targetPhase as TrainingPhase] || MUTED_NEUTRAL_DARK}15`,
                            }}
                          >
                            {session.targetPhase.slice(0, 3)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-surface-700 dark:text-surface-300">
                    <span>{session.blocks.length} blocks</span>
                    {totalThrows > 0 && <span>{totalThrows} throws</span>}
                    <span>{session.assignments.length} assigned</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
