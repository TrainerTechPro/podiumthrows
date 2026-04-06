/**
 * Dashboard progress data helpers — server-side fetchers for the
 * This Week, PR Tracker, and Weekly Goal widgets.
 *
 * All three compute their results from existing columns and the existing
 * Goal model; no schema changes required.
 */

import prisma from "@/lib/prisma";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type ThisWeekData = {
  thisWeek: {
    totalThrows: number;
    daysTrained: number;
    bestDistance: number | null;
    implementsUsed: number;
  };
  lastWeek: {
    totalThrows: number;
    daysTrained: number;
    bestDistance: number | null;
    implementsUsed: number;
  };
  deltas: {
    throws: number;
    daysTrained: number;
    bestDistance: number | null;
    implementsUsed: number;
  };
  weekStart: string;
  weekEnd: string;
};

export type PRTrackerRow = {
  throwLogId: string;
  event: string;
  implementWeight: number;
  distance: number;
  date: string;
  nextTargetDistance: number;
};

export type PRTrackerData = {
  rows: PRTrackerRow[];
};

export type WeeklyGoalData = {
  goal: {
    id: string;
    title: string;
    targetValue: number;
    unit: string;
    deadline: string | null;
  } | null;
  currentValue: number;
  progressPct: number;
  isHit: boolean;
  weekStart: string;
  weekEnd: string;
};

/* ─── Week helpers ───────────────────────────────────────────────────────── */

/** Start of this week = Monday 00:00 local time (weeks are coach-friendly: Mon–Sun). */
export function startOfWeek(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const offset = day === 0 ? 6 : day - 1; // subtract back to Monday
  d.setDate(d.getDate() - offset);
  return d;
}

/** End of week (exclusive) = start of next week. */
export function endOfWeek(now: Date = new Date()): Date {
  const start = startOfWeek(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}

/** Start of last week = 7 days before start of this week. */
function startOfLastWeek(now: Date = new Date()): Date {
  const start = startOfWeek(now);
  const prev = new Date(start);
  prev.setDate(prev.getDate() - 7);
  return prev;
}

/* ─── This Week ──────────────────────────────────────────────────────────── */

type RawThrow = {
  distance: number | null;
  event: string;
  implementWeight: number;
  date: Date;
};

function summarize(rows: RawThrow[]): ThisWeekData["thisWeek"] {
  const totalThrows = rows.length;

  const dayKeys = new Set<string>();
  for (const r of rows) {
    const d = r.date;
    dayKeys.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }

  const distances = rows.map((r) => r.distance).filter((d): d is number => d != null);
  const bestDistance = distances.length > 0 ? Math.max(...distances) : null;

  const implementSet = new Set<string>();
  for (const r of rows) {
    implementSet.add(`${r.event}:${r.implementWeight}`);
  }

  return {
    totalThrows,
    daysTrained: dayKeys.size,
    bestDistance,
    implementsUsed: implementSet.size,
  };
}

export async function fetchThisWeekData(athleteId: string): Promise<ThisWeekData> {
  const now = new Date();
  const thisStart = startOfWeek(now);
  const thisEnd = endOfWeek(now);
  const lastStart = startOfLastWeek(now);
  const lastEnd = thisStart;

  const [thisWeekRows, lastWeekRows] = await Promise.all([
    prisma.throwLog.findMany({
      where: {
        athleteId,
        date: { gte: thisStart, lt: thisEnd },
      },
      select: { distance: true, event: true, implementWeight: true, date: true },
    }),
    prisma.throwLog.findMany({
      where: {
        athleteId,
        date: { gte: lastStart, lt: lastEnd },
      },
      select: { distance: true, event: true, implementWeight: true, date: true },
    }),
  ]);

  const thisWeek = summarize(thisWeekRows as RawThrow[]);
  const lastWeek = summarize(lastWeekRows as RawThrow[]);

  return {
    thisWeek,
    lastWeek,
    deltas: {
      throws: thisWeek.totalThrows - lastWeek.totalThrows,
      daysTrained: thisWeek.daysTrained - lastWeek.daysTrained,
      bestDistance:
        thisWeek.bestDistance != null && lastWeek.bestDistance != null
          ? thisWeek.bestDistance - lastWeek.bestDistance
          : null,
      implementsUsed: thisWeek.implementsUsed - lastWeek.implementsUsed,
    },
    weekStart: thisStart.toISOString(),
    weekEnd: thisEnd.toISOString(),
  };
}

/* ─── PR Tracker ─────────────────────────────────────────────────────────── */

const NEXT_TARGET_DELTA_METERS = 0.1;

export async function fetchPRTrackerData(athleteId: string): Promise<PRTrackerData> {
  // Every throw that's currently marked as a PR. Because checkAndSetPR() keys
  // PRs on (event, implementWeight), there is at most ONE isPersonalBest=true
  // throw per (event, implementWeight) combo — no dedupe needed here.
  const prs = await prisma.throwLog.findMany({
    where: {
      athleteId,
      isPersonalBest: true,
      distance: { not: null },
    },
    orderBy: [
      { event: "asc" },
      { implementWeight: "desc" },
    ],
    select: {
      id: true,
      event: true,
      implementWeight: true,
      distance: true,
      date: true,
    },
  });

  const rows: PRTrackerRow[] = prs.map((p) => {
    const distance = p.distance as number;
    return {
      throwLogId: p.id,
      event: p.event as string,
      implementWeight: p.implementWeight,
      distance,
      date: p.date.toISOString(),
      nextTargetDistance: Math.round((distance + NEXT_TARGET_DELTA_METERS) * 100) / 100,
    };
  });

  return { rows };
}

/* ─── Weekly Goal ────────────────────────────────────────────────────────── */

export async function fetchWeeklyGoalData(athleteId: string): Promise<WeeklyGoalData> {
  const now = new Date();
  const thisStart = startOfWeek(now);
  const thisEnd = endOfWeek(now);

  // Find an active "throws" goal whose deadline is within or after this week.
  // We match on (unit === "throws") and status === "ACTIVE" and a deadline that
  // hasn't yet fallen before this week's start. The most recently created one
  // wins if there are multiple (athletes shouldn't have multiple but we're
  // defensive).
  const goal = await prisma.goal.findFirst({
    where: {
      athleteId,
      status: "ACTIVE",
      unit: "throws",
      OR: [
        { deadline: null },
        { deadline: { gte: thisStart } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      targetValue: true,
      unit: true,
      deadline: true,
    },
  });

  // Count this week's throws regardless of goal existence — we return the
  // count either way so the widget can show "0/30" before a goal is set or
  // after one is created.
  const thisWeekCount = await prisma.throwLog.count({
    where: {
      athleteId,
      date: { gte: thisStart, lt: thisEnd },
    },
  });

  const target = goal?.targetValue ?? 0;
  const progressPct =
    target > 0 ? Math.min(100, Math.round((thisWeekCount / target) * 100)) : 0;

  return {
    goal: goal
      ? {
          id: goal.id,
          title: goal.title,
          targetValue: goal.targetValue,
          unit: goal.unit,
          deadline: goal.deadline?.toISOString() ?? null,
        }
      : null,
    currentValue: thisWeekCount,
    progressPct,
    isHit: target > 0 && thisWeekCount >= target,
    weekStart: thisStart.toISOString(),
    weekEnd: thisEnd.toISOString(),
  };
}
