import prisma from "@/lib/prisma";

export type WeeklyRecapPR = {
  event: string;
  implement: string;
  distance: number;
  /** Improvement vs previous best, in meters. null when prior best is unknown. */
  delta: number | null;
};

export type WeeklyRecapPayload = {
  athleteId: string;
  weekStart: string; // ISO date YYYY-MM-DD (start of Mon)
  weekEnd: string; // ISO date YYYY-MM-DD (end of Sun)
  sessionsLogged: number;
  sessionsScheduled: number;
  throwsLogged: number;
  /** Average overall RPE across logged sessions in the window. null if none. */
  avgIntensity: number | null;
  prs: WeeklyRecapPR[];
  /** Streak snapshot at start vs end of the week. */
  streakStart: number;
  streakEnd: number;
  streakDelta: number;
  /** Average readiness 1-10 across check-ins in window. null if none. */
  readinessAvg: number | null;
  shoutout: string;
  nextWeekPreview: {
    sessionsCount: number;
    /** ISO date of next scheduled assignment or upcoming competition; null if neither. */
    keyDate: string | null;
  };
};

/* ─── Week boundary helpers ──────────────────────────────────────────────── */

function startOfMondayUTC(d: Date): Date {
  const day = d.getUTCDay(); // 0 Sun – 6 Sat
  const offset = day === 0 ? -6 : 1 - day; // shift to most recent Monday
  const base = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  base.setUTCDate(base.getUTCDate() + offset);
  return base;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eventLabel(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Main ───────────────────────────────────────────────────────────────── */

export interface BuildWeeklyRecapOpts {
  /** Defaults to the most recently completed week. Pass to backfill / preview. */
  weekStartingMonday?: Date;
}

export async function buildWeeklyRecap(
  athleteId: string,
  opts: BuildWeeklyRecapOpts = {}
): Promise<WeeklyRecapPayload> {
  const now = new Date();
  // The "most recently completed week" runs Monday → Sunday (inclusive). The
  // recap fires Sunday evening, so when invoked from cron we report on the
  // Monday→Sunday block that's wrapping up TODAY.
  const weekMonday = opts.weekStartingMonday ?? startOfMondayUTC(now);
  const weekSunday = new Date(weekMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
  const weekEndExclusive = new Date(weekMonday.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekStartISO = isoDate(weekMonday);
  const weekEndISO = isoDate(weekSunday);

  const [
    athlete,
    completedAssignments,
    sessionsScheduled,
    blockLogs,
    weekPRs,
    readinessCheckIns,
    nextAssignment,
    nextCompetition,
  ] = await Promise.all([
    prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: {
        id: true,
        firstName: true,
        currentStreak: true,
        lastActivityDate: true,
      },
    }),

    prisma.throwsAssignment.findMany({
      where: {
        athleteId,
        completedAt: { gte: weekMonday, lt: weekEndExclusive },
      },
      select: { id: true, rpe: true, completedAt: true },
    }),

    prisma.throwsAssignment.count({
      where: {
        athleteId,
        assignedDate: { gte: weekStartISO, lte: weekEndISO },
      },
    }),

    prisma.throwsBlockLog.aggregate({
      _count: { _all: true },
      where: {
        assignment: { athleteId },
        createdAt: { gte: weekMonday, lt: weekEndExclusive },
      },
    }),

    // Catalog-keyed PRs. bestAchievedAt is DateTime; week bounds are
    // YYYY-MM-DD strings — convert. Reshape to the legacy
    // {event, implement, distance} contract the recap template consumes.
    prisma.athleteImplementPR
      .findMany({
        where: {
          athleteId,
          bestAchievedAt: {
            gte: new Date(weekStartISO + "T00:00:00"),
            lte: new Date(weekEndISO + "T23:59:59"),
          },
          bestDistance: { not: null },
        },
        orderBy: { bestDistance: "desc" },
        take: 5,
        include: {
          implement: { select: { throwType: true, displayLabel: true } },
        },
      })
      .then((rows) =>
        rows.map((pr) => ({
          event: pr.implement.throwType === "SHOT" ? "SHOT_PUT" : pr.implement.throwType,
          implement: pr.implement.displayLabel,
          distance: pr.bestDistance!,
        }))
      ),

    prisma.readinessCheckIn.findMany({
      where: {
        athleteId,
        date: { gte: weekMonday, lt: weekEndExclusive },
      },
      select: { overallScore: true },
    }),

    prisma.throwsAssignment.findFirst({
      where: {
        athleteId,
        assignedDate: { gt: weekEndISO },
      },
      orderBy: { assignedDate: "asc" },
      select: { assignedDate: true },
    }),

    prisma.throwsCompetition.findFirst({
      where: {
        athleteId,
        date: { gt: weekEndISO },
      },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
  ]);

  if (!athlete) {
    throw new Error(`Athlete not found: ${athleteId}`);
  }

  const sessionsLogged = completedAssignments.length;
  const throwsLogged = blockLogs._count._all ?? 0;

  const rpeValues = completedAssignments
    .map((a) => a.rpe)
    .filter((rpe): rpe is number => typeof rpe === "number");
  const avgIntensity =
    rpeValues.length > 0
      ? Math.round((rpeValues.reduce((s, v) => s + v, 0) / rpeValues.length) * 10) / 10
      : null;

  const readinessValues = readinessCheckIns.map((r) => r.overallScore);
  const readinessAvg =
    readinessValues.length > 0
      ? Math.round((readinessValues.reduce((s, v) => s + v, 0) / readinessValues.length) * 10) / 10
      : null;

  // Streak snapshot. We only have the current value; estimate the start-of-
  // week value by counting unique-day activity recorded this week.
  const streakEnd = athlete.currentStreak;
  // Days within [weekMonday, weekEndExclusive) that had a logged assignment.
  const uniqueDays = new Set<string>();
  for (const c of completedAssignments) {
    if (c.completedAt) uniqueDays.add(c.completedAt.toISOString().slice(0, 10));
  }
  const streakDelta = uniqueDays.size;
  const streakStart = Math.max(0, streakEnd - streakDelta);

  const prs: WeeklyRecapPR[] = weekPRs.map((p) => ({
    event: p.event,
    implement: p.implement,
    distance: Math.round(p.distance * 100) / 100,
    delta: null, // ThrowsPR row is upserted; prior best isn't preserved
  }));

  const shoutout = pickShoutout({
    prs,
    sessionsLogged,
    streakDelta,
    firstName: athlete.firstName,
  });

  const nextWeekStart = weekEndExclusive;
  const nextWeekEnd = new Date(nextWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sessionsNextWeek = await prisma.throwsAssignment.count({
    where: {
      athleteId,
      assignedDate: { gte: isoDate(nextWeekStart), lt: isoDate(nextWeekEnd) },
    },
  });

  // Competition.date and ThrowsAssignment.assignedDate are both YYYY-MM-DD
  // strings — the earlier one wins.
  const compDate = nextCompetition?.date ?? null;
  const asgDate = nextAssignment?.assignedDate ?? null;
  const keyDate =
    compDate && asgDate ? (compDate < asgDate ? compDate : asgDate) : (compDate ?? asgDate);

  return {
    athleteId,
    weekStart: weekStartISO,
    weekEnd: weekEndISO,
    sessionsLogged,
    sessionsScheduled,
    throwsLogged,
    avgIntensity,
    prs,
    streakStart,
    streakEnd,
    streakDelta,
    readinessAvg,
    shoutout,
    nextWeekPreview: {
      sessionsCount: sessionsNextWeek,
      keyDate,
    },
  };
}

/* ─── Shoutout ───────────────────────────────────────────────────────────── */

function pickShoutout(args: {
  prs: WeeklyRecapPR[];
  sessionsLogged: number;
  streakDelta: number;
  firstName: string;
}): string {
  if (args.prs.length > 0) {
    const top = args.prs[0];
    return `New ${eventLabel(top.event)} PR — ${top.distance.toFixed(2)}m`;
  }
  if (args.streakDelta >= 4) {
    return `${args.streakDelta} sessions this week — that's how PRs get built.`;
  }
  if (args.sessionsLogged > 0) {
    return `Steady week, ${args.firstName}. Compounding adds up.`;
  }
  return `New week, fresh start. Get one logged Monday and the rest follows.`;
}

/**
 * Activity gate for the cron — athletes with no recent footprint don't get
 * recaps (they're on a quiet hiatus and a recap nag is the wrong move).
 */
export async function isAthleteActive(athleteId: string, sinceDays = 30): Promise<boolean> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const [logCount, sessionCount, readinessCount] = await Promise.all([
    prisma.throwsBlockLog.count({
      where: { assignment: { athleteId }, createdAt: { gte: since } },
      take: 1,
    }),
    prisma.throwsAssignment.count({
      where: { athleteId, completedAt: { gte: since } },
      take: 1,
    }),
    prisma.readinessCheckIn.count({
      where: { athleteId, date: { gte: since } },
      take: 1,
    }),
  ]);
  return logCount + sessionCount + readinessCount > 0;
}
