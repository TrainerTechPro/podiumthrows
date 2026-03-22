/**
 * Server-side data-fetching functions for coach pages.
 * All functions return plain serializable objects (dates as ISO strings)
 * so they can be passed from Server Components to Client Components.
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { SubscriptionPlan } from "@prisma/client";

/**
 * Per-request cached coachProfile lookup by userId.
 * React cache() deduplicates identical calls within one server render tree,
 * so the layout and each page both calling this never fire more than one query.
 */
export const fetchCoachByUserId = cache(async (userId: string) => {
  return prisma.coachProfile.findUnique({ where: { userId } });
});

/* ─── Constants ──────────────────────────────────────────────────────────── */

export const PLAN_LIMITS: Record<SubscriptionPlan, number> = {
  FREE: 3,
  PRO: 25,
  ELITE: Infinity,
};

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type ActivityItem = {
  id: string;
  type: "check_in" | "personal_best" | "session_complete" | "streak_break" | "injury_change" | "missed_session" | "sports_form" | "autoregulation";
  athleteId: string;
  athleteName: string;
  athleteAvatar: string | null;
  date: string; // ISO string
  detail?: string;
  // check_in
  score?: number;
  // personal_best
  event?: string;
  distance?: number;
  // session_complete
  rpe?: number | null;
};

export type AthleteRosterItem = {
  id: string;
  firstName: string;
  lastName: string;
  events: string[];
  avatarUrl: string | null;
  currentStreak: number;
  latestReadiness: {
    score: number;
    injuryStatus: string;
    date: string;
  } | null;
  lastSessionDate: string | null;
};

export type FlaggedAthlete = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  events: string[];
  reason: "low_readiness" | "injured" | "no_checkin";
  score?: number;
  injuryStatus?: string;
  daysSinceCheckin?: number;
};

export type ReadinessTrendPoint = {
  id: string;
  date: string; // ISO string
  overallScore: number;
  sleepQuality: number;
  sleepHours: number;
  soreness: number;
  sorenessArea: string | null;
  stressLevel: number;
  energyMood: number;
  injuryStatus: string;
  injuryNotes: string | null;
  hydration: string;
  notes: string | null;
};

export type ThrowLogItem = {
  id: string;
  date: string;
  event: string;
  implementWeight: number;
  distance: number;
  isPersonalBest: boolean;
  isCompetition: boolean;
  notes: string | null;
};

export type SessionItem = {
  id: string;
  scheduledDate: string;
  completedDate: string | null;
  status: string;
  rpe: number | null;
  notes: string | null;
  coachNotes: string | null;
  planName: string | null;
};

export type GoalItem = {
  id: string;
  title: string;
  description: string | null;
  targetValue: number;
  currentValue: number;
  startingValue: number | null;
  unit: string;
  event: string | null;
  deadline: string | null;
  status: string;
  progressPct: number;
  createdAt: string;
  /** ISO date string if projectable, null if not enough data */
  projectedCompletionDate: string | null;
};

export type AthleteACWR = {
  acute: number;
  chronic: number;
  ratio: number;
  sessionsInAcute: number;
  sessionsInChronic: number;
} | null;

export type ExerciseItem = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  event: string | null;
  implementWeight: number | null;
  equipment: string | null;
  defaultSets: number | null;
  defaultReps: string | null;
  isGlobal: boolean;
  isOwn: boolean; // true if coachId matches
  usageCount: number; // how many plans use this exercise
};

export type CoachStats = {
  totalAthletes: number;
  lowReadiness: number;
  sessionsToday: number;
  injured: number;
  complianceRate: number | null;
  throwsThisWeek: number;
  prsThisWeek: number;
};

export type OnboardingStep = {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  href: string;
  ctaLabel: string;
  /** If true, this step is locked until the previous step is completed */
  requiresPrevious: boolean;
};

export type OnboardingStatus = {
  isCompleted: boolean;
  completedAt: string | null;
  steps: OnboardingStep[];
  completedCount: number;
  totalSteps: number;
};

/* ─── Auth Helper ─────────────────────────────────────────────────────────── */

/** Require authenticated coach session. Redirects to /login otherwise.
 *  Use in Server Components / Server Actions only (uses redirect()). */
export async function requireCoachSession() {
  const session = await getSession();
  if (!session || session.role !== "COACH") redirect("/login");

  const coach = await fetchCoachByUserId(session.userId);
  if (!coach) redirect("/login");

  return { session, coach };
}

/** Route-Handler-safe version: returns { session, coach } or throws
 *  an AuthError (never calls redirect). Use this in API Route Handlers. */
export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireCoachApi() {
  const session = await getSession();
  if (!session || session.role !== "COACH") throw new AuthError();

  const coach = await fetchCoachByUserId(session.userId);
  if (!coach) throw new AuthError();

  return { session, coach };
}

/* ─── Dashboard Data ──────────────────────────────────────────────────────── */

export async function getCoachStats(coachId: string): Promise<CoachStats> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  function daysAgoISO(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  // Get roster IDs for queries that need them
  const rosterAthletes = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: { id: true },
  });
  const rosterIds = rosterAthletes.map((a) => a.id);

  const [
    totalAthletes,
    athletesWithReadiness,
    sessionsToday,
    sessionStats,
    throwsBlockLogCount,
    practiceAttemptCount,
    drillLogThrowsAgg,
    throwsPRCount,
    drillPRCount,
  ] = await Promise.all([
    prisma.athleteProfile.count({ where: { coachId } }),

    prisma.athleteProfile.findMany({
      where: { coachId },
      select: {
        readinessCheckIns: {
          orderBy: { date: "desc" },
          take: 1,
          select: { overallScore: true, injuryStatus: true },
        },
      },
    }),

    prisma.trainingSession.count({
      where: {
        athlete: { coachId },
        scheduledDate: { gte: startOfToday, lt: endOfToday },
        status: { not: "SKIPPED" },
      },
    }),

    prisma.trainingSession.groupBy({
      by: ["status"],
      where: {
        athlete: { coachId },
        scheduledDate: { gte: thirtyDaysAgo, lt: startOfToday },
      },
      _count: { _all: true },
    }),

    // throwsThisWeek source 1: ThrowsBlockLog
    prisma.throwsBlockLog.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
        assignment: { athlete: { coachId } },
      },
    }),

    // throwsThisWeek source 2: PracticeAttempt
    rosterIds.length > 0
      ? prisma.practiceAttempt.count({
          where: {
            createdAt: { gte: sevenDaysAgo },
            athleteId: { in: rosterIds },
          },
        })
      : Promise.resolve(0),

    // throwsThisWeek source 3: AthleteDrillLog (sum throwCount)
    prisma.athleteDrillLog.aggregate({
      _sum: { throwCount: true },
      where: {
        createdAt: { gte: sevenDaysAgo },
        session: { athlete: { coachId } },
      },
    }),

    // prsThisWeek source 1: ThrowsPR (achievedAt is String YYYY-MM-DD)
    prisma.throwsPR.count({
      where: {
        achievedAt: { gte: daysAgoISO(7) },
        athlete: { coachId },
      },
    }),

    // prsThisWeek source 2: ThrowsDrillPR (achievedAt is String YYYY-MM-DD)
    prisma.throwsDrillPR.count({
      where: {
        achievedAt: { gte: daysAgoISO(7) },
        athlete: { coachId },
      },
    }),
  ]);

  const lowReadiness = athletesWithReadiness.filter(
    (a) => (a.readinessCheckIns[0]?.overallScore ?? 10) < 5
  ).length;

  const injured = athletesWithReadiness.filter(
    (a) => a.readinessCheckIns[0]?.injuryStatus === "ACTIVE"
  ).length;

  const completed =
    sessionStats.find((s) => s.status === "COMPLETED")?._count._all ?? 0;
  const skipped =
    sessionStats.find((s) => s.status === "SKIPPED")?._count._all ?? 0;
  const totalPast = completed + skipped;
  const complianceRate =
    totalPast > 0 ? Math.round((completed / totalPast) * 100) : null;

  const throwsThisWeek =
    throwsBlockLogCount +
    practiceAttemptCount +
    (drillLogThrowsAgg._sum.throwCount ?? 0);

  const prsThisWeek = throwsPRCount + drillPRCount;

  return {
    totalAthletes,
    lowReadiness,
    sessionsToday,
    injured,
    complianceRate,
    throwsThisWeek,
    prsThisWeek,
  };
}

export async function getRecentActivity(
  coachId: string,
  limit = 20,
  notableOnly = false
): Promise<ActivityItem[]> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const [checkIns, prs, completedSessions, ...notableResults] = await Promise.all([
    prisma.readinessCheckIn.findMany({
      where: { athlete: { coachId }, date: { gte: cutoff } },
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { date: "desc" },
      take: limit,
    }),

    prisma.throwLog.findMany({
      where: { athlete: { coachId }, isPersonalBest: true, date: { gte: cutoff } },
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { date: "desc" },
      take: limit,
    }),

    // When notableOnly, skip routine session completions entirely
    notableOnly
      ? Promise.resolve([])
      : prisma.trainingSession.findMany({
          where: {
            athlete: { coachId },
            status: "COMPLETED",
            completedDate: { gte: cutoff },
          },
          include: {
            athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
          orderBy: { completedDate: "desc" },
          take: limit,
        }),

    // Missed sessions (only when notableOnly)
    ...(notableOnly
      ? [
          prisma.throwsAssignment.findMany({
            where: {
              athlete: { coachId },
              status: "SKIPPED",
              updatedAt: { gte: cutoff },
            },
            include: {
              athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
          }),
        ]
      : []),
  ]);

  // Filter check-ins: when notableOnly, only include low scores
  const filteredCheckIns = notableOnly
    ? checkIns.filter((c) => c.overallScore < 4.0)
    : checkIns;

  const items: ActivityItem[] = [
    ...filteredCheckIns.map((c) => ({
      id: c.id,
      type: "check_in" as const,
      athleteId: c.athlete.id,
      athleteName: `${c.athlete.firstName} ${c.athlete.lastName}`,
      athleteAvatar: c.athlete.avatarUrl,
      date: c.date.toISOString(),
      score: c.overallScore,
      ...(notableOnly && c.overallScore < 4.0
        ? { detail: `Low readiness: ${c.overallScore.toFixed(1)}` }
        : {}),
    })),
    ...prs.map((p) => ({
      id: p.id,
      type: "personal_best" as const,
      athleteId: p.athlete.id,
      athleteName: `${p.athlete.firstName} ${p.athlete.lastName}`,
      athleteAvatar: p.athlete.avatarUrl,
      date: p.date.toISOString(),
      event: p.event,
      distance: p.distance,
    })),
    ...completedSessions.map((s) => ({
      id: s.id,
      type: "session_complete" as const,
      athleteId: s.athlete.id,
      athleteName: `${s.athlete.firstName} ${s.athlete.lastName}`,
      athleteAvatar: s.athlete.avatarUrl,
      date: s.completedDate!.toISOString(),
      rpe: s.rpe,
    })),
  ];

  // Add missed sessions when notableOnly
  if (notableOnly && notableResults[0]) {
    const missedSessions = notableResults[0] as Array<{
      id: string;
      updatedAt: Date;
      skipReason: string | null;
      athlete: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
    }>;
    for (const m of missedSessions) {
      items.push({
        id: m.id,
        type: "missed_session" as const,
        athleteId: m.athlete.id,
        athleteName: `${m.athlete.firstName} ${m.athlete.lastName}`,
        athleteAvatar: m.athlete.avatarUrl,
        date: m.updatedAt.toISOString(),
        detail: m.skipReason ?? "Session skipped",
      });
    }
  }

  return items
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

export async function getFlaggedAthletes(coachId: string): Promise<FlaggedAthlete[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      events: true,
      readinessCheckIns: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true, overallScore: true, injuryStatus: true },
      },
    },
  });

  const flagged: FlaggedAthlete[] = [];

  for (const athlete of athletes) {
    const latest = athlete.readinessCheckIns[0];
    const base = {
      id: athlete.id,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      avatarUrl: athlete.avatarUrl,
      events: athlete.events as string[],
    };

    if (latest?.injuryStatus === "ACTIVE") {
      flagged.push({ ...base, reason: "injured", injuryStatus: "ACTIVE", score: latest.overallScore });
    } else if (latest && latest.overallScore < 5) {
      flagged.push({ ...base, reason: "low_readiness", score: latest.overallScore });
    } else if (!latest || latest.date < sevenDaysAgo) {
      const daysSince = latest
        ? Math.floor((Date.now() - latest.date.getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      flagged.push({ ...base, reason: "no_checkin", daysSinceCheckin: daysSince });
    }
  }

  return flagged;
}

/* ─── Athletes Roster ─────────────────────────────────────────────────────── */

export async function getAthleteRoster(coachId: string): Promise<AthleteRosterItem[]> {
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      events: true,
      avatarUrl: true,
      currentStreak: true,
      readinessCheckIns: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true, overallScore: true, injuryStatus: true },
      },
      trainingSessions: {
        where: { status: "COMPLETED" },
        orderBy: { completedDate: "desc" },
        take: 1,
        select: { completedDate: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return athletes.map((a) => ({
    id: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    events: a.events as string[],
    avatarUrl: a.avatarUrl,
    currentStreak: a.currentStreak,
    latestReadiness: a.readinessCheckIns[0]
      ? {
          score: a.readinessCheckIns[0].overallScore,
          injuryStatus: a.readinessCheckIns[0].injuryStatus as string,
          date: a.readinessCheckIns[0].date.toISOString(),
        }
      : null,
    lastSessionDate:
      a.trainingSessions[0]?.completedDate?.toISOString() ?? null,
  }));
}

/* ─── Athlete Profile ─────────────────────────────────────────────────────── */

/** Fetch full athlete profile, verifying it belongs to this coach. */
export async function getAthleteFull(athleteId: string, coachId: string) {
  return prisma.athleteProfile.findFirst({
    where: { id: athleteId, coachId },
    include: {
      user: { select: { email: true, createdAt: true } },
    },
  });
}

export async function getAthleteReadinessTrend(
  athleteId: string,
  days = 30
): Promise<ReadinessTrendPoint[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const checkIns = await prisma.readinessCheckIn.findMany({
    where: { athleteId, date: { gte: cutoff } },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      overallScore: true,
      sleepQuality: true,
      sleepHours: true,
      soreness: true,
      sorenessArea: true,
      stressLevel: true,
      energyMood: true,
      injuryStatus: true,
      injuryNotes: true,
      hydration: true,
      notes: true,
    },
  });

  return checkIns.map((c) => ({
    id: c.id,
    date: c.date.toISOString(),
    overallScore: c.overallScore,
    sleepQuality: c.sleepQuality,
    sleepHours: c.sleepHours,
    soreness: c.soreness,
    sorenessArea: c.sorenessArea,
    stressLevel: c.stressLevel,
    energyMood: c.energyMood,
    injuryStatus: c.injuryStatus as string,
    injuryNotes: c.injuryNotes,
    hydration: c.hydration as string,
    notes: c.notes,
  }));
}

export async function getAthleteThrowHistory(
  athleteId: string,
  event?: string
): Promise<ThrowLogItem[]> {
  const throws = await prisma.throwLog.findMany({
    where: {
      athleteId,
      ...(event ? { event: event as never } : {}),
    },
    orderBy: { date: "desc" },
    take: 100,
    select: {
      id: true,
      date: true,
      event: true,
      implementWeight: true,
      distance: true,
      isPersonalBest: true,
      isCompetition: true,
      notes: true,
    },
  });

  return throws.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    event: t.event as string,
    implementWeight: t.implementWeight,
    distance: t.distance,
    isPersonalBest: t.isPersonalBest,
    isCompetition: t.isCompetition,
    notes: t.notes,
  }));
}

export async function getAthleteSessions(
  athleteId: string,
  limit = 20
): Promise<SessionItem[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: { athleteId },
    orderBy: { scheduledDate: "desc" },
    take: limit,
    include: {
      plan: { select: { name: true } },
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    scheduledDate: s.scheduledDate.toISOString(),
    completedDate: s.completedDate?.toISOString() ?? null,
    status: s.status as string,
    rpe: s.rpe,
    notes: s.notes,
    coachNotes: s.coachNotes,
    planName: s.plan?.name ?? null,
  }));
}

export async function getAthleteGoals(athleteId: string): Promise<GoalItem[]> {
  const goals = await prisma.goal.findMany({
    where: { athleteId },
    orderBy: [{ status: "asc" }, { deadline: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      targetValue: true,
      currentValue: true,
      startingValue: true,
      unit: true,
      event: true,
      deadline: true,
      status: true,
      createdAt: true,
    },
  });

  const now = Date.now();

  return goals.map((g) => {
    const baseline = g.startingValue ?? 0;
    const range = g.targetValue - baseline;
    const gained = g.currentValue - baseline;
    const progressPct =
      range > 0 ? Math.min(100, Math.max(0, Math.round((gained / range) * 100))) : 0;

    // Projected completion: rate = gained / daysElapsed; daysToComplete = remaining / rate
    let projectedCompletionDate: string | null = null;
    const daysElapsed = (now - g.createdAt.getTime()) / 86_400_000;
    const remaining = g.targetValue - g.currentValue;
    if (
      g.startingValue !== null &&
      daysElapsed > 0 &&
      gained > 0 &&
      remaining > 0
    ) {
      const ratePerDay = gained / daysElapsed;
      const daysToCompletion = remaining / ratePerDay;
      projectedCompletionDate = new Date(now + daysToCompletion * 86_400_000).toISOString();
    }

    return {
      id: g.id,
      title: g.title,
      description: g.description,
      targetValue: g.targetValue,
      currentValue: g.currentValue,
      startingValue: g.startingValue,
      unit: g.unit,
      event: g.event as string | null,
      deadline: g.deadline?.toISOString() ?? null,
      status: g.status as string,
      progressPct,
      createdAt: g.createdAt.toISOString(),
      projectedCompletionDate,
    };
  });
}

/* ─── Team-Wide Goal Item (extends GoalItem with athlete info) ───────────── */

export type TeamGoalItem = GoalItem & {
  athleteId: string;
  athleteFirstName: string;
  athleteLastName: string;
};

export async function getTeamGoals(coachId: string): Promise<TeamGoalItem[]> {
  const goals = await prisma.goal.findMany({
    where: {
      athlete: { coachId },
    },
    orderBy: [{ status: "asc" }, { deadline: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      targetValue: true,
      currentValue: true,
      startingValue: true,
      unit: true,
      event: true,
      deadline: true,
      status: true,
      createdAt: true,
      athleteId: true,
      athlete: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  const now = Date.now();

  return goals.map((g) => {
    const baseline = g.startingValue ?? 0;
    const range = g.targetValue - baseline;
    const gained = g.currentValue - baseline;
    const progressPct =
      range > 0 ? Math.min(100, Math.max(0, Math.round((gained / range) * 100))) : 0;

    let projectedCompletionDate: string | null = null;
    const daysElapsed = (now - g.createdAt.getTime()) / 86_400_000;
    const remaining = g.targetValue - g.currentValue;
    if (
      g.startingValue !== null &&
      daysElapsed > 0 &&
      gained > 0 &&
      remaining > 0
    ) {
      const ratePerDay = gained / daysElapsed;
      const daysToCompletion = remaining / ratePerDay;
      projectedCompletionDate = new Date(now + daysToCompletion * 86_400_000).toISOString();
    }

    return {
      id: g.id,
      title: g.title,
      description: g.description,
      targetValue: g.targetValue,
      currentValue: g.currentValue,
      startingValue: g.startingValue,
      unit: g.unit,
      event: g.event as string | null,
      deadline: g.deadline?.toISOString() ?? null,
      status: g.status as string,
      progressPct,
      createdAt: g.createdAt.toISOString(),
      projectedCompletionDate,
      athleteId: g.athleteId,
      athleteFirstName: g.athlete.firstName,
      athleteLastName: g.athlete.lastName,
    };
  });
}

export async function getAthleteRecentPRs(athleteId: string, limit = 5): Promise<ThrowLogItem[]> {
  const prs = await prisma.throwLog.findMany({
    where: { athleteId, isPersonalBest: true },
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true,
      date: true,
      event: true,
      implementWeight: true,
      distance: true,
      isPersonalBest: true,
      isCompetition: true,
      notes: true,
    },
  });

  return prs.map((p) => ({
    id: p.id,
    date: p.date.toISOString(),
    event: p.event as string,
    implementWeight: p.implementWeight,
    distance: p.distance,
    isPersonalBest: p.isPersonalBest,
    isCompetition: p.isCompetition,
    notes: p.notes,
  }));
}

/* ─── Exercise Library ────────────────────────────────────────────────────── */

export async function getExerciseLibrary(
  coachId: string,
  filters?: {
    category?: string;
    event?: string;
    equipment?: string;
    search?: string;
  }
): Promise<ExerciseItem[]> {
  const where: Record<string, unknown> = {
    OR: [{ isGlobal: true }, { coachId }],
  };

  if (filters?.category) {
    where.category = filters.category;
  }
  if (filters?.event) {
    where.event = filters.event;
  }
  if (filters?.equipment) {
    where.equipment = filters.equipment;
  }
  if (filters?.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  const exercises = await prisma.exercise.findMany({
    where: where as never,
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      coachId: true,
      name: true,
      description: true,
      category: true,
      event: true,
      implementWeight: true,
      equipment: true,
      defaultSets: true,
      defaultReps: true,
      isGlobal: true,
      _count: { select: { blockExercises: true } },
    },
  });

  return exercises.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    category: e.category as string,
    event: e.event as string | null,
    implementWeight: e.implementWeight,
    equipment: e.equipment,
    defaultSets: e.defaultSets,
    defaultReps: e.defaultReps,
    isGlobal: e.isGlobal,
    isOwn: e.coachId === coachId,
    usageCount: e._count.blockExercises,
  }));
}

export async function createExercise(
  coachId: string,
  data: {
    name: string;
    description?: string;
    category: string;
    event?: string;
    implementWeight?: number;
    equipment?: string;
    defaultSets?: number;
    defaultReps?: string;
  }
): Promise<ExerciseItem> {
  const exercise = await prisma.exercise.create({
    data: {
      coachId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      category: data.category as never,
      event: data.event ? (data.event as never) : null,
      implementWeight: data.implementWeight ?? null,
      equipment: data.equipment || null,
      defaultSets: data.defaultSets ?? null,
      defaultReps: data.defaultReps?.trim() || null,
      isGlobal: false,
    },
    select: {
      id: true,
      coachId: true,
      name: true,
      description: true,
      category: true,
      event: true,
      implementWeight: true,
      equipment: true,
      defaultSets: true,
      defaultReps: true,
      isGlobal: true,
      _count: { select: { blockExercises: true } },
    },
  });

  return {
    id: exercise.id,
    name: exercise.name,
    description: exercise.description,
    category: exercise.category as string,
    event: exercise.event as string | null,
    implementWeight: exercise.implementWeight,
    equipment: exercise.equipment,
    defaultSets: exercise.defaultSets,
    defaultReps: exercise.defaultReps,
    isGlobal: exercise.isGlobal,
    isOwn: true,
    usageCount: exercise._count.blockExercises,
  };
}

export async function updateExercise(
  exerciseId: string,
  coachId: string,
  data: {
    name?: string;
    description?: string;
    category?: string;
    event?: string | null;
    implementWeight?: number | null;
    equipment?: string | null;
    defaultSets?: number | null;
    defaultReps?: string | null;
  }
): Promise<ExerciseItem> {
  // Verify ownership — can only edit own exercises
  const existing = await prisma.exercise.findFirst({
    where: { id: exerciseId, coachId, isGlobal: false },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Exercise not found or not editable.");
  }

  const exercise = await prisma.exercise.update({
    where: { id: exerciseId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() || null }),
      ...(data.category !== undefined && { category: data.category as never }),
      ...(data.event !== undefined && { event: data.event ? (data.event as never) : null }),
      ...(data.implementWeight !== undefined && { implementWeight: data.implementWeight }),
      ...(data.equipment !== undefined && { equipment: data.equipment }),
      ...(data.defaultSets !== undefined && { defaultSets: data.defaultSets }),
      ...(data.defaultReps !== undefined && { defaultReps: data.defaultReps?.trim() || null }),
    },
    select: {
      id: true,
      coachId: true,
      name: true,
      description: true,
      category: true,
      event: true,
      implementWeight: true,
      equipment: true,
      defaultSets: true,
      defaultReps: true,
      isGlobal: true,
      _count: { select: { blockExercises: true } },
    },
  });

  return {
    id: exercise.id,
    name: exercise.name,
    description: exercise.description,
    category: exercise.category as string,
    event: exercise.event as string | null,
    implementWeight: exercise.implementWeight,
    equipment: exercise.equipment,
    defaultSets: exercise.defaultSets,
    defaultReps: exercise.defaultReps,
    isGlobal: exercise.isGlobal,
    isOwn: true,
    usageCount: exercise._count.blockExercises,
  };
}

export async function deleteExercise(
  exerciseId: string,
  coachId: string
): Promise<void> {
  // Verify ownership
  const existing = await prisma.exercise.findFirst({
    where: { id: exerciseId, coachId, isGlobal: false },
    select: { id: true, _count: { select: { blockExercises: true } } },
  });
  if (!existing) {
    throw new Error("Exercise not found or not deletable.");
  }
  if (existing._count.blockExercises > 0) {
    throw new Error("Cannot delete an exercise that is used in workout plans.");
  }

  await prisma.exercise.delete({ where: { id: exerciseId } });
}

/* ─── Workout Plans ──────────────────────────────────────────────────────── */

export type WorkoutPlanItem = {
  id: string;
  name: string;
  description: string | null;
  event: string | null;
  isTemplate: boolean;
  blockCount: number;
  sessionCount: number;
  createdAt: string;
};

export type WorkoutBlockDetail = {
  id: string;
  name: string;
  order: number;
  blockType: string;
  restSeconds: number | null;
  notes: string | null;
  exercises: BlockExerciseDetail[];
};

export type BlockExerciseDetail = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseCategory: string;
  order: number;
  sets: number | null;
  reps: string | null;
  weight: string | null;
  rpe: number | null;
  distance: string | null;
  restSeconds: number | null;
  notes: string | null;
  implementKg: number | null;
};

export type WorkoutPlanDetail = {
  id: string;
  name: string;
  description: string | null;
  event: string | null;
  isTemplate: boolean;
  blocks: WorkoutBlockDetail[];
  createdAt: string;
};

export type CoachSessionItem = {
  id: string;
  athleteId: string;
  athleteFirstName: string;
  athleteLastName: string;
  athleteAvatarUrl: string | null;
  planName: string | null;
  scheduledDate: string;
  completedDate: string | null;
  status: string;
  rpe: number | null;
};

export async function getWorkoutPlans(coachId: string): Promise<WorkoutPlanItem[]> {
  const plans = await prisma.workoutPlan.findMany({
    where: { coachId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      event: true,
      isTemplate: true,
      createdAt: true,
      _count: { select: { blocks: true, sessions: true } },
    },
  });

  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    event: p.event as string | null,
    isTemplate: p.isTemplate,
    blockCount: p._count.blocks,
    sessionCount: p._count.sessions,
    createdAt: p.createdAt.toISOString(),
  }));
}

export async function getWorkoutPlanDetail(
  planId: string,
  coachId: string
): Promise<WorkoutPlanDetail | null> {
  const plan = await prisma.workoutPlan.findFirst({
    where: { id: planId, coachId },
    include: {
      blocks: {
        orderBy: { order: "asc" },
        include: {
          exercises: {
            orderBy: { order: "asc" },
            include: {
              exercise: { select: { name: true, category: true } },
            },
          },
        },
      },
    },
  });

  if (!plan) return null;

  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    event: plan.event as string | null,
    isTemplate: plan.isTemplate,
    createdAt: plan.createdAt.toISOString(),
    blocks: plan.blocks.map((b) => ({
      id: b.id,
      name: b.name,
      order: b.order,
      blockType: b.blockType,
      restSeconds: b.restSeconds,
      notes: b.notes,
      exercises: b.exercises.map((e) => ({
        id: e.id,
        exerciseId: e.exerciseId,
        exerciseName: e.exercise.name,
        exerciseCategory: e.exercise.category as string,
        order: e.order,
        sets: e.sets,
        reps: e.reps,
        weight: e.weight,
        rpe: e.rpe,
        distance: e.distance,
        restSeconds: e.restSeconds,
        notes: e.notes,
        implementKg: e.implementKg,
      })),
    })),
  };
}

export async function getCoachSessions(
  coachId: string,
  filters?: { status?: string; athleteId?: string }
): Promise<CoachSessionItem[]> {
  const where: Record<string, unknown> = {
    athlete: { coachId },
  };
  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.athleteId) {
    where.athleteId = filters.athleteId;
  }

  const sessions = await prisma.trainingSession.findMany({
    where: where as never,
    orderBy: { scheduledDate: "desc" },
    take: 100,
    include: {
      athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      plan: { select: { name: true } },
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    athleteId: s.athlete.id,
    athleteFirstName: s.athlete.firstName,
    athleteLastName: s.athlete.lastName,
    athleteAvatarUrl: s.athlete.avatarUrl,
    planName: s.plan?.name ?? null,
    scheduledDate: s.scheduledDate.toISOString(),
    completedDate: s.completedDate?.toISOString() ?? null,
    status: s.status as string,
    rpe: s.rpe,
  }));
}

export type AthletePickerItem = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  events: string[];
};

export async function getAthletePickerList(coachId: string): Promise<AthletePickerItem[]> {
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      events: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return athletes.map((a) => ({
    id: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    avatarUrl: a.avatarUrl,
    events: a.events as string[],
  }));
}

/* ─── Throw Analytics ────────────────────────────────────────────────────── */

export type ThrowStatsByEvent = {
  event: string;
  totalThrows: number;
  bestDistance: number;
  avgDistance: number;
  recentAvgDistance: number; // last 5 throws
  implementWeights: number[]; // distinct implement weights used
};

export type ThrowsByImplement = {
  implementWeight: number;
  throws: {
    id: string;
    date: string;
    distance: number;
    isPersonalBest: boolean;
    isCompetition: boolean;
    rpe: number | null;
    notes: string | null;
  }[];
};

export type TeamThrowSummaryItem = {
  athleteId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  events: string[];
  totalThrows: number;
  latestPR: { event: string; distance: number; date: string; implementWeight: number } | null;
  recentThrowCount: number; // last 7 days
  bondarchukType: string | null;
};

export type PRLeaderboardEntry = {
  athleteId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  event: string;
  distance: number;
  implementWeight: number;
  date: string;
};

export async function getAthleteThrowStats(athleteId: string): Promise<ThrowStatsByEvent[]> {
  const throws = await prisma.throwLog.findMany({
    where: { athleteId },
    select: { event: true, distance: true, implementWeight: true, date: true },
    orderBy: { date: "desc" },
  });

  // Group by event
  const byEvent: Record<string, typeof throws> = {};
  for (const t of throws) {
    const ev = t.event as string;
    if (!byEvent[ev]) byEvent[ev] = [];
    byEvent[ev].push(t);
  }

  return Object.entries(byEvent).map(([event, eventThrows]) => {
    const distances = eventThrows.map((t) => t.distance);
    const recent5 = distances.slice(0, 5);
    const implementWeights = Array.from(new Set(eventThrows.map((t) => t.implementWeight))).sort((a, b) => b - a);

    return {
      event,
      totalThrows: eventThrows.length,
      bestDistance: Math.max(...distances),
      avgDistance: parseFloat((distances.reduce((s, d) => s + d, 0) / distances.length).toFixed(2)),
      recentAvgDistance: parseFloat((recent5.reduce((s, d) => s + d, 0) / recent5.length).toFixed(2)),
      implementWeights,
    };
  });
}

export async function getAthleteThrowsByImplement(
  athleteId: string,
  event: string
): Promise<ThrowsByImplement[]> {
  const throws = await prisma.throwLog.findMany({
    where: { athleteId, event: event as never },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      distance: true,
      implementWeight: true,
      isPersonalBest: true,
      isCompetition: true,
      rpe: true,
      notes: true,
    },
  });

  const byWeight: Record<number, typeof throws> = {};
  for (const t of throws) {
    if (!byWeight[t.implementWeight]) byWeight[t.implementWeight] = [];
    byWeight[t.implementWeight].push(t);
  }

  return Object.entries(byWeight)
    .map(([weight, weightThrows]) => ({
      implementWeight: parseFloat(weight),
      throws: weightThrows.map((t) => ({
        id: t.id,
        date: t.date.toISOString(),
        distance: t.distance,
        isPersonalBest: t.isPersonalBest,
        isCompetition: t.isCompetition,
        rpe: t.rpe,
        notes: t.notes,
      })),
    }))
    .sort((a, b) => b.implementWeight - a.implementWeight); // heaviest first
}

export async function getTeamThrowSummary(coachId: string): Promise<TeamThrowSummaryItem[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      events: true,
      throwLogs: {
        select: { id: true, event: true, distance: true, implementWeight: true, date: true, isPersonalBest: true },
        orderBy: { date: "desc" },
      },
      assessments: {
        orderBy: { completedAt: "desc" },
        take: 1,
        select: { athleteType: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return athletes.map((a) => {
    const latestPRThrow = a.throwLogs.find((t) => t.isPersonalBest);
    const recentThrowCount = a.throwLogs.filter((t) => t.date >= sevenDaysAgo).length;

    return {
      athleteId: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      avatarUrl: a.avatarUrl,
      events: a.events as string[],
      totalThrows: a.throwLogs.length,
      latestPR: latestPRThrow
        ? {
            event: latestPRThrow.event as string,
            distance: latestPRThrow.distance,
            date: latestPRThrow.date.toISOString(),
            implementWeight: latestPRThrow.implementWeight,
          }
        : null,
      recentThrowCount,
      bondarchukType: (a.assessments[0]?.athleteType as string) ?? null,
    };
  });
}

export async function getTeamPRLeaderboard(
  coachId: string,
  event?: string
): Promise<PRLeaderboardEntry[]> {
  const where: Record<string, unknown> = {
    athlete: { coachId },
    isPersonalBest: true,
  };
  if (event) {
    where.event = event as never;
  }

  const prs = await prisma.throwLog.findMany({
    where: where as never,
    orderBy: { distance: "desc" },
    take: 50,
    select: {
      event: true,
      distance: true,
      implementWeight: true,
      date: true,
      athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  return prs.map((p) => ({
    athleteId: p.athlete.id,
    firstName: p.athlete.firstName,
    lastName: p.athlete.lastName,
    avatarUrl: p.athlete.avatarUrl,
    event: p.event as string,
    distance: p.distance,
    implementWeight: p.implementWeight,
    date: p.date.toISOString(),
  }));
}

/* ─── Bondarchuk Assessment Data ─────────────────────────────────────────── */

export type BondarchukAssessmentItem = {
  id: string;
  athleteType: string;
  results: unknown;
  notes: string | null;
  completedAt: string;
};

export async function getAthleteBondarchukAssessments(
  athleteId: string,
  coachId: string
): Promise<BondarchukAssessmentItem[]> {
  // Verify the athlete belongs to this coach
  const athlete = await prisma.athleteProfile.findFirst({
    where: { id: athleteId, coachId },
    select: { id: true },
  });
  if (!athlete) return [];

  const assessments = await prisma.bondarchukAssessment.findMany({
    where: { athleteId },
    orderBy: { completedAt: "desc" },
    select: {
      id: true,
      athleteType: true,
      results: true,
      notes: true,
      completedAt: true,
    },
  });

  return assessments.map((a) => ({
    id: a.id,
    athleteType: a.athleteType as string,
    results: a.results,
    notes: a.notes,
    completedAt: a.completedAt.toISOString(),
  }));
}

export async function getLatestBondarchukAssessment(
  athleteId: string
): Promise<BondarchukAssessmentItem | null> {
  const assessment = await prisma.bondarchukAssessment.findFirst({
    where: { athleteId },
    orderBy: { completedAt: "desc" },
    select: {
      id: true,
      athleteType: true,
      results: true,
      notes: true,
      completedAt: true,
    },
  });

  if (!assessment) return null;

  return {
    id: assessment.id,
    athleteType: assessment.athleteType as string,
    results: assessment.results,
    notes: assessment.notes,
    completedAt: assessment.completedAt.toISOString(),
  };
}

export type CorrelationExerciseItem = {
  id: string;
  name: string;
  category: string;
  event: string | null;
  implementWeight: number | null;
  equipment: string | null;
  correlation: number;
};

export async function getExerciseRecommendations(
  event: string,
  coachId: string
): Promise<CorrelationExerciseItem[]> {
  const exercises = await prisma.exercise.findMany({
    where: {
      OR: [{ isGlobal: true }, { coachId }],
      correlationData: { not: { equals: undefined } },
    },
    select: {
      id: true,
      name: true,
      category: true,
      event: true,
      implementWeight: true,
      equipment: true,
      correlationData: true,
    },
  });

  const results: CorrelationExerciseItem[] = [];

  for (const ex of exercises) {
    const corrData = ex.correlationData as Record<string, { correlation: number }> | null;
    if (!corrData || !corrData[event]) continue;

    results.push({
      id: ex.id,
      name: ex.name,
      category: ex.category as string,
      event: ex.event as string | null,
      implementWeight: ex.implementWeight,
      equipment: ex.equipment,
      correlation: corrData[event].correlation,
    });
  }

  // Sort by correlation descending
  return results.sort((a, b) => b.correlation - a.correlation);
}

/* ─── Drill Library ──────────────────────────────────────────────────────── */

export type DrillItem = {
  id: string;
  name: string;
  description: string | null;
  videoUrl: string | null;
  event: string | null;
  category: string;
  implementKg: number | null;
  difficulty: string | null;
  cues: string[];
  athleteTypes: string[];
  isGlobal: boolean;
  isOwn: boolean;
};

export async function getDrillLibrary(
  coachId: string,
  filters?: {
    event?: string;
    category?: string;
    difficulty?: string;
    athleteType?: string;
    search?: string;
  }
): Promise<DrillItem[]> {
  const where: Record<string, unknown> = {
    OR: [{ isGlobal: true }, { coachId }],
  };
  if (filters?.event) where.event = filters.event;
  if (filters?.category) where.category = filters.category;
  if (filters?.difficulty) where.difficulty = filters.difficulty;
  if (filters?.athleteType) where.athleteTypes = { has: filters.athleteType };
  if (filters?.search) where.name = { contains: filters.search, mode: "insensitive" };

  const drills = await prisma.drill.findMany({
    where: where as never,
    orderBy: [{ event: "asc" }, { category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      coachId: true,
      name: true,
      description: true,
      videoUrl: true,
      event: true,
      category: true,
      implementKg: true,
      difficulty: true,
      cues: true,
      athleteTypes: true,
      isGlobal: true,
    },
  });

  return drills.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    videoUrl: d.videoUrl,
    event: d.event as string | null,
    category: d.category as string,
    implementKg: d.implementKg,
    difficulty: d.difficulty,
    cues: d.cues,
    athleteTypes: d.athleteTypes as string[],
    isGlobal: d.isGlobal,
    isOwn: d.coachId === coachId,
  }));
}

/* ─── ACWR ───────────────────────────────────────────────────────────────── */

export async function getAthleteACWR(athleteId: string): Promise<AthleteACWR> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  // Single query for the full 28-day window; partition in JS for the 7-day acute window
  const allSessions = await prisma.trainingSession.findMany({
    where: {
      athleteId,
      status: "COMPLETED",
      completedDate: { gte: twentyEightDaysAgo },
      rpe: { not: null },
    },
    select: { rpe: true, completedDate: true },
  });

  const chronicSessions = allSessions;
  const acuteSessions = allSessions.filter(
    (s) => s.completedDate !== null && s.completedDate >= sevenDaysAgo
  );

  if (chronicSessions.length === 0) return null;

  const acuteAvg =
    acuteSessions.length > 0
      ? acuteSessions.reduce((s, sess) => s + (sess.rpe ?? 0), 0) /
        acuteSessions.length
      : 0;
  const chronicAvg =
    chronicSessions.reduce((s, sess) => s + (sess.rpe ?? 0), 0) /
    chronicSessions.length;

  if (chronicAvg === 0) return null;

  return {
    acute: Math.round(acuteAvg * 10) / 10,
    chronic: Math.round(chronicAvg * 10) / 10,
    ratio: Math.round((acuteAvg / chronicAvg) * 100) / 100,
    sessionsInAcute: acuteSessions.length,
    sessionsInChronic: chronicSessions.length,
  };
}

/* ─── Questionnaires ────────────────────────────────────────────────────── */

export type QuestionnaireListItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  questionCount: number;
  blockCount: number;
  displayMode: string;
  scoringEnabled: boolean;
  responseCount: number;
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
};

export async function getCoachQuestionnaires(coachId: string): Promise<QuestionnaireListItem[]> {
  const questionnaires = await prisma.questionnaire.findMany({
    where: { coachId, isActive: true },
    include: {
      _count: {
        select: {
          responses: true,
          assignments: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return questionnaires.map((q) => ({
    id: q.id,
    title: q.title,
    description: q.description,
    type: q.type as string,
    status: q.status,
    questionCount: Array.isArray(q.questions) ? (q.questions as unknown[]).length : 0,
    blockCount: Array.isArray(q.blocks) ? (q.blocks as unknown[]).length : 0,
    displayMode: q.displayMode as string,
    scoringEnabled: q.scoringEnabled,
    responseCount: q._count.responses,
    assignmentCount: q._count.assignments,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  }));
}

export type QuestionnaireDetail = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  questions: Array<{
    id: string;
    text: string;
    type: string;
    options?: string[];
    required?: boolean;
  }>;
  blocks: unknown[] | null;
  displayMode: string;
  conditionalLogic: unknown | null;
  scoringEnabled: boolean;
  scoringRules: unknown | null;
  isActive: boolean;
  responseCount: number;
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
};

export async function getQuestionnaireById(
  id: string,
  coachId: string
): Promise<QuestionnaireDetail | null> {
  const q = await prisma.questionnaire.findFirst({
    where: { id, coachId },
    include: {
      _count: {
        select: {
          responses: true,
          assignments: true,
        },
      },
    },
  });

  if (!q) return null;

  return {
    id: q.id,
    title: q.title,
    description: q.description,
    type: q.type as string,
    status: q.status,
    questions: (q.questions as unknown as QuestionnaireDetail["questions"]) ?? [],
    blocks: (q.blocks as unknown[] | null) ?? null,
    displayMode: q.displayMode as string,
    conditionalLogic: q.conditionalLogic ?? null,
    scoringEnabled: q.scoringEnabled,
    scoringRules: q.scoringRules ?? null,
    isActive: q.isActive,
    responseCount: q._count.responses,
    assignmentCount: q._count.assignments,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

export type QuestionnaireResponseItem = {
  id: string;
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  answers: Array<{
    questionId?: string;
    questionText?: string;
    blockId?: string;
    blockLabel?: string;
    blockType?: string;
    answer: unknown;
  }>;
  scores: {
    blockScores: Array<{
      blockId: string;
      blockLabel: string;
      blockType: string;
      answer: unknown;
      score?: number;
    }>;
    compositeScore: number | null;
    maxPossibleScore: number;
  } | null;
  durationSeconds: number | null;
  completedAt: string;
};

export async function getQuestionnaireResponses(
  questionnaireId: string,
  coachId: string
): Promise<QuestionnaireResponseItem[]> {
  // Verify ownership
  const q = await prisma.questionnaire.findFirst({
    where: { id: questionnaireId, coachId },
    select: { id: true },
  });
  if (!q) return [];

  const responses = await prisma.questionnaireResponse.findMany({
    where: { questionnaireId },
    include: {
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  return responses.map((r) => ({
    id: r.id,
    athleteId: r.athlete.id,
    athleteName: `${r.athlete.firstName} ${r.athlete.lastName}`,
    avatarUrl: r.athlete.avatarUrl,
    answers: (r.answers as unknown as QuestionnaireResponseItem["answers"]) ?? [],
    scores: (r.scores as unknown as QuestionnaireResponseItem["scores"]) ?? null,
    durationSeconds: r.durationSeconds ?? null,
    completedAt: r.completedAt.toISOString(),
  }));
}

export type QuestionnaireAssignmentInfo = {
  athleteId: string;
  athleteName: string;
  assignedAt: string;
  completedAt: string | null;
};

export async function getQuestionnaireAssignments(
  questionnaireId: string,
  coachId: string
): Promise<QuestionnaireAssignmentInfo[]> {
  const q = await prisma.questionnaire.findFirst({
    where: { id: questionnaireId, coachId },
    select: { id: true },
  });
  if (!q) return [];

  const assignments = await prisma.questionnaireAssignment.findMany({
    where: { questionnaireId },
    include: {
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  return assignments.map((a) => ({
    athleteId: a.athlete.id,
    athleteName: `${a.athlete.firstName} ${a.athlete.lastName}`,
    assignedAt: a.assignedAt.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null,
  }));
}

/* ─── Score Trends (for recurring forms) ──────────────────────────────────── */

export type ScoreTrendPoint = {
  responseId: string;
  athleteId: string;
  athleteName: string;
  compositeScore: number | null;
  maxPossibleScore: number;
  completedAt: string;
};

export async function getQuestionnaireScoreTrends(
  questionnaireId: string,
  coachId: string,
  limit = 50
): Promise<ScoreTrendPoint[]> {
  const q = await prisma.questionnaire.findFirst({
    where: { id: questionnaireId, coachId },
    select: { id: true, scoringEnabled: true },
  });
  if (!q || !q.scoringEnabled) return [];

  const responses = await prisma.questionnaireResponse.findMany({
    where: {
      questionnaireId,
      scores: { not: Prisma.JsonNull },
    },
    include: {
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { completedAt: "asc" },
    take: limit,
  });

  return responses.map((r) => {
    const scores = r.scores as unknown as {
      compositeScore: number | null;
      maxPossibleScore: number;
    } | null;
    return {
      responseId: r.id,
      athleteId: r.athlete.id,
      athleteName: `${r.athlete.firstName} ${r.athlete.lastName}`,
      compositeScore: scores?.compositeScore ?? null,
      maxPossibleScore: scores?.maxPossibleScore ?? 0,
      completedAt: r.completedAt.toISOString(),
    };
  });
}

/* ─── Team Readiness Overview (for dashboard widget) ─────────────────────── */

export type TeamReadinessEntry = {
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  latestScore: number | null;
  maxScore: number;
  completedAt: string;
  trend: "up" | "down" | "stable" | null;
};

export async function getTeamReadinessTrends(
  coachId: string
): Promise<TeamReadinessEntry[]> {
  // Find all readiness/check-in questionnaires for this coach that have scoring
  const readinessQuestionnaires = await prisma.questionnaire.findMany({
    where: {
      coachId,
      scoringEnabled: true,
      type: { in: ["READINESS", "CHECK_IN"] },
    },
    select: { id: true },
  });

  if (readinessQuestionnaires.length === 0) return [];

  const qIds = readinessQuestionnaires.map((q) => q.id);

  // Get the latest 2 scored responses per athlete across all readiness forms
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  });

  // Batch all athlete responses in a single query instead of N per-athlete queries
  const allResponses = await prisma.questionnaireResponse.findMany({
    where: {
      athleteId: { in: athletes.map((a) => a.id) },
      questionnaireId: { in: qIds },
      scores: { not: Prisma.JsonNull },
    },
    orderBy: { completedAt: "desc" },
    take: 200,
    select: {
      athleteId: true,
      scores: true,
      completedAt: true,
    },
  });

  // Group by athlete, keep latest 2 per athlete (responses are desc-sorted globally)
  const responsesByAthlete = new Map<string, typeof allResponses>();
  for (const r of allResponses) {
    const arr = responsesByAthlete.get(r.athleteId) ?? [];
    if (arr.length < 2) {
      arr.push(r);
      responsesByAthlete.set(r.athleteId, arr);
    }
  }

  const results: TeamReadinessEntry[] = [];

  for (const athlete of athletes) {
    const recentResponses = responsesByAthlete.get(athlete.id) ?? [];

    if (recentResponses.length === 0) continue;

    const latest = recentResponses[0];
    const latestScores = latest.scores as unknown as {
      compositeScore: number | null;
      maxPossibleScore: number;
    } | null;

    let trend: "up" | "down" | "stable" | null = null;
    if (recentResponses.length >= 2) {
      const prev = recentResponses[1];
      const prevScores = prev.scores as unknown as {
        compositeScore: number | null;
      } | null;
      if (
        latestScores?.compositeScore != null &&
        prevScores?.compositeScore != null
      ) {
        const diff = latestScores.compositeScore - prevScores.compositeScore;
        trend = diff > 0.5 ? "up" : diff < -0.5 ? "down" : "stable";
      }
    }

    results.push({
      athleteId: athlete.id,
      athleteName: `${athlete.firstName} ${athlete.lastName}`,
      avatarUrl: athlete.avatarUrl,
      latestScore: latestScores?.compositeScore ?? null,
      maxScore: latestScores?.maxPossibleScore ?? 0,
      completedAt: latest.completedAt.toISOString(),
      trend,
    });
  }

  // Sort by score ascending so low readiness shows first
  results.sort((a, b) => (a.latestScore ?? 0) - (b.latestScore ?? 0));

  return results;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  VIDEO                                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

export type VideoListItem = {
  id: string;
  title: string | null;
  url: string;
  thumbnailUrl: string | null;
  event: string | null;
  category: string | null;
  status: string;
  athleteId: string | null;
  athleteName: string | null;
  durationSec: number | null;
  fileSizeMb: number | null;
  annotationCount: number;
  tags: string[];
  createdAt: string;
};

export type VideoDetail = {
  id: string;
  title: string | null;
  description: string | null;
  url: string;
  storageKey: string | null;
  thumbnailUrl: string | null;
  /** GOP-15 transcoded MP4 — preferred for frame extraction (faster seeking) */
  transcodedUrl: string | null;
  /** "pending" | "processing" | "completed" | "failed" */
  transcodeStatus: string | null;
  event: string | null;
  category: string | null;
  status: string;
  tags: string[];
  annotations: unknown;
  durationSec: number | null;
  fileSizeMb: number | null;
  coachId: string | null;
  athleteId: string | null;
  athleteName: string | null;
  sharedWithAthletes: string[];
  createdAt: string;
  updatedAt: string;
};

export type VideoStats = {
  total: number;
  byEvent: Record<string, number>;
  recentCount: number;
};

export async function getCoachVideos(
  coachId: string,
  filters?: {
    event?: string;
    category?: string;
    athleteId?: string;
    search?: string;
  }
): Promise<VideoListItem[]> {
  const where: Record<string, unknown> = { coachId };

  if (filters?.event) where.event = filters.event;
  if (filters?.category) where.category = filters.category;
  if (filters?.athleteId) where.athleteId = filters.athleteId;
  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const videos = await prisma.videoUpload.findMany({
    where,
    select: {
      id: true,
      title: true,
      url: true,
      thumbnailUrl: true,
      event: true,
      category: true,
      status: true,
      athleteId: true,
      annotations: true,
      durationSec: true,
      fileSizeMb: true,
      tags: true,
      createdAt: true,
      athlete: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return videos.map((v) => {
    const annotations = Array.isArray(v.annotations) ? v.annotations : [];
    return {
      id: v.id,
      title: v.title,
      url: v.url,
      thumbnailUrl: v.thumbnailUrl,
      event: (v.event as string) ?? null,
      category: v.category,
      status: v.status,
      athleteId: v.athleteId,
      athleteName: v.athlete
        ? `${v.athlete.firstName} ${v.athlete.lastName}`
        : null,
      durationSec: v.durationSec,
      fileSizeMb: v.fileSizeMb,
      annotationCount: annotations.length,
      tags: v.tags,
      createdAt: v.createdAt.toISOString(),
    };
  });
}

export async function getVideoById(
  id: string,
  coachId: string
): Promise<VideoDetail | null> {
  const video = await prisma.videoUpload.findFirst({
    where: { id, coachId },
    include: {
      athlete: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!video) return null;

  return {
    id: video.id,
    title: video.title,
    description: video.description,
    url: video.url,
    storageKey: video.storageKey,
    thumbnailUrl: video.thumbnailUrl,
    transcodedUrl: video.transcodedUrl ?? null,
    transcodeStatus: video.transcodeStatus ?? null,
    event: (video.event as string) ?? null,
    category: video.category,
    status: video.status,
    tags: video.tags,
    annotations: video.annotations,
    durationSec: video.durationSec,
    fileSizeMb: video.fileSizeMb,
    coachId: video.coachId,
    athleteId: video.athleteId,
    athleteName: video.athlete
      ? `${video.athlete.firstName} ${video.athlete.lastName}`
      : null,
    sharedWithAthletes: video.sharedWithAthletes,
    createdAt: video.createdAt.toISOString(),
    updatedAt: video.updatedAt.toISOString(),
  };
}

export async function getCoachVideoStats(
  coachId: string
): Promise<VideoStats> {
  const videos = await prisma.videoUpload.findMany({
    where: { coachId, status: "ready" },
    select: { event: true, createdAt: true },
  });

  const byEvent: Record<string, number> = {};
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let recentCount = 0;

  for (const v of videos) {
    const ev = (v.event as string) ?? "untagged";
    byEvent[ev] = (byEvent[ev] || 0) + 1;
    if (v.createdAt >= sevenDaysAgo) recentCount++;
  }

  return { total: videos.length, byEvent, recentCount };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  NOTIFICATIONS                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  athleteId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export async function getCoachNotifications(
  coachId: string,
  opts: { unreadOnly?: boolean; limit?: number } = {}
): Promise<NotificationItem[]> {
  const { unreadOnly = false, limit = 50 } = opts;
  const notifications = await prisma.notification.findMany({
    where: {
      coachId,
      ...(unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      read: true,
      athleteId: true,
      metadata: true,
      createdAt: true,
    },
  });

  return notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    read: n.read,
    athleteId: n.athleteId,
    metadata: n.metadata as Record<string, unknown> | null,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function getUnreadNotificationCount(coachId: string): Promise<number> {
  return prisma.notification.count({
    where: { coachId, read: false },
  });
}

/* ─── Onboarding Status ──────────────────────────────────────────────────── */

/**
 * Compute onboarding checklist status from real data — no step counter needed.
 * Returns early if onboarding is already completed/dismissed.
 */
export async function getOnboardingStatus(
  coachId: string,
  /** Pass the already-fetched value to avoid a redundant coachProfile query. */
  cachedCompletedAt?: Date | null
): Promise<OnboardingStatus> {
  // Use caller-supplied value when available; fall back to a DB lookup otherwise
  const onboardingCompletedAt =
    cachedCompletedAt !== undefined
      ? cachedCompletedAt
      : (
          await prisma.coachProfile.findUnique({
            where: { id: coachId },
            select: { onboardingCompletedAt: true },
          })
        )?.onboardingCompletedAt ?? null;

  const TOTAL_STEPS = 5;

  if (onboardingCompletedAt) {
    return {
      isCompleted: true,
      completedAt: onboardingCompletedAt.toISOString(),
      steps: [],
      completedCount: TOTAL_STEPS,
      totalSteps: TOTAL_STEPS,
    };
  }

  // Derive step completion from actual data
  const [coachProfile, athleteCount, pendingInviteCount, throwsProfileCount, profileWithPb, programCount, sessionCount] =
    await Promise.all([
      prisma.coachProfile.findUnique({
        where: { id: coachId },
        select: { bio: true, organization: true, avatarUrl: true },
      }),
      prisma.athleteProfile.count({ where: { coachId } }),
      prisma.invitation.count({ where: { coachId, status: "PENDING" } }),
      prisma.throwsProfile.count({ where: { enrolledBy: coachId } }),
      prisma.throwsProfile.count({
        where: { enrolledBy: coachId, competitionPb: { not: null } },
      }),
      prisma.trainingProgram.count({ where: { coachId } }),
      prisma.throwsSession.count({ where: { coachId } }),
    ]);

  const hasProfile = !!(coachProfile?.bio || coachProfile?.organization || coachProfile?.avatarUrl);
  const hasAthlete = athleteCount > 0 || pendingInviteCount > 0;
  const hasThrowsProfile = throwsProfileCount > 0;
  const hasAssessment = profileWithPb > 0;
  const hasProgram = programCount > 0 || sessionCount > 0;

  const steps: OnboardingStep[] = [
    {
      key: "profile",
      label: "Complete your coach profile",
      description: "Add your bio, organization, or photo so athletes know who you are",
      completed: hasProfile,
      href: "/coach/settings",
      ctaLabel: "Edit Profile",
      requiresPrevious: false,
    },
    {
      key: "invite",
      label: "Invite your first athlete",
      description: "Send a link to an athlete to join your roster",
      completed: hasAthlete,
      href: "/coach/athletes",
      ctaLabel: "Invite Athlete",
      requiresPrevious: false,
    },
    {
      key: "throws_profile",
      label: "Create a throws profile",
      description: "Set up event, gender, and competition PB for an athlete",
      completed: hasThrowsProfile,
      href: "/coach/throws",
      ctaLabel: "Create Profile",
      requiresPrevious: true,
    },
    {
      key: "assessment",
      label: "Run a baseline assessment",
      description: "Record implement PRs to diagnose training deficits",
      completed: hasAssessment,
      href: "/coach/throws",
      ctaLabel: "Run Assessment",
      requiresPrevious: true,
    },
    {
      key: "program",
      label: "Build your first program",
      description: "Generate a Bondarchuk training program",
      completed: hasProgram,
      href: "/coach/throws/program-builder",
      ctaLabel: "Build Program",
      requiresPrevious: true,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;

  // Auto-persist completion when all steps are done organically
  if (completedCount === steps.length) {
    // Fire-and-forget — don't block the render on this write
    prisma.coachProfile
      .update({
        where: { id: coachId },
        data: { onboardingCompletedAt: new Date() },
      })
      .catch(() => {
        // Silently ignore — next load will retry
      });

    return {
      isCompleted: true,
      completedAt: new Date().toISOString(),
      steps: [],
      completedCount,
      totalSteps: steps.length,
    };
  }

  return {
    isCompleted: false,
    completedAt: null,
    steps,
    completedCount,
    totalSteps: steps.length,
  };
}
