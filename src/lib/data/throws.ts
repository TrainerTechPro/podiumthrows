/**
 * Server-side data-fetching functions for the Throws Hub.
 * Extracted from API routes so they can be called directly from Server Components,
 * eliminating the client-side fetch waterfall on the throws dashboard.
 */

import prisma from "@/lib/prisma";

/* ─── Sessions ──────────────────────────────────────────────────────────── */

export async function getThrowsSessions(coachId: string) {
  return prisma.throwsSession.findMany({
    where: { coachId },
    include: {
      blocks: { orderBy: { position: "asc" } },
      assignments: {
        include: {
          athlete: { include: { user: { select: { id: true, email: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/* ─── Roster Pulse ──────────────────────────────────────────────────────── */

const IMPLEMENT_STANDARDS: Record<string, { m: number; f: number }> = {
  SHOT_PUT: { m: 7.26, f: 4 },
  DISCUS: { m: 2, f: 1 },
  HAMMER: { m: 7.26, f: 4 },
  JAVELIN: { m: 0.8, f: 0.6 },
};

function classifyImplement(
  implement: string,
  event: string
): "heavy" | "competition" | "light" {
  const val = parseFloat(implement.replace(/[^0-9.]/g, "")) || 0;
  const std = IMPLEMENT_STANDARDS[event];
  if (!std) return "competition";
  const midpoint = std.m;
  if (val > midpoint * 1.05) return "heavy";
  if (val < midpoint * 0.9) return "light";
  return "competition";
}

export async function getThrowsRosterPulse(coachId: string) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Core roster with base data
  const roster = await prisma.throwsProfile.findMany({
    where: { enrolledBy: coachId, status: "active" },
    include: {
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          throwsPRs: { select: { event: true, implement: true, distance: true } },
          throwsCheckIns: {
            orderBy: { date: "desc" },
            take: 1,
            select: { date: true, selfFeeling: true, energy: true, sorenessGeneral: true },
          },
        },
      },
      testingRecords: {
        orderBy: { testDate: "desc" },
        take: 1,
        select: { testDate: true, testType: true },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const athleteIds = roster.map((r) => r.athleteId);
  if (athleteIds.length === 0) return [];

  const [practiceAttempts7d, recentAttempts14d, latestPractice] = await Promise.all([
    prisma.practiceAttempt.findMany({
      where: { athleteId: { in: athleteIds }, createdAt: { gte: sevenDaysAgo } },
      select: {
        athleteId: true,
        implement: true,
        distance: true,
        event: true,
        session: { select: { date: true } },
      },
    }),
    prisma.practiceAttempt.findMany({
      where: {
        athleteId: { in: athleteIds },
        createdAt: { gte: fourteenDaysAgo },
        distance: { not: null },
      },
      select: {
        athleteId: true,
        event: true,
        distance: true,
        session: { select: { date: true } },
      },
      orderBy: { distance: "desc" },
    }),
    prisma.practiceAttempt.findMany({
      where: { athleteId: { in: athleteIds } },
      distinct: ["athleteId"],
      orderBy: { createdAt: "desc" },
      select: { athleteId: true, session: { select: { date: true } } },
    }),
  ]);

  // Index by athleteId
  const attemptsByAthlete: Record<string, typeof practiceAttempts7d> = {};
  for (const a of practiceAttempts7d) {
    if (!attemptsByAthlete[a.athleteId]) attemptsByAthlete[a.athleteId] = [];
    attemptsByAthlete[a.athleteId].push(a);
  }

  const bestMark14dByAthlete: Record<string, { distance: number; date: string } | null> = {};
  for (const a of recentAttempts14d) {
    if (!bestMark14dByAthlete[a.athleteId] && a.distance != null) {
      bestMark14dByAthlete[a.athleteId] = { distance: a.distance, date: a.session.date };
    }
  }

  const lastPracticeByAthlete: Record<string, string | null> = {};
  for (const a of latestPractice) {
    lastPracticeByAthlete[a.athleteId] = a.session.date;
  }

  const data = roster.map((r) => {
    const athleteAttempts = attemptsByAthlete[r.athleteId] ?? [];
    const throwsThisWeek = athleteAttempts.length;

    const split = { heavy: 0, competition: 0, light: 0 };
    for (const attempt of athleteAttempts) {
      split[classifyImplement(attempt.implement, attempt.event)]++;
    }

    const lastPracticeDate = lastPracticeByAthlete[r.athleteId] ?? null;
    const daysSincePractice = lastPracticeDate
      ? Math.floor((now.getTime() - new Date(lastPracticeDate).getTime()) / 86_400_000)
      : null;

    const testingRecords = r.testingRecords ?? [];
    const daysSinceTest =
      testingRecords.length > 0
        ? Math.floor(
            (now.getTime() - new Date(testingRecords[0].testDate).getTime()) / 86_400_000
          )
        : null;
    const testStatus: "never" | "overdue" | "due-soon" | "ok" =
      testingRecords.length === 0
        ? "never"
        : daysSinceTest! > 14
        ? "overdue"
        : daysSinceTest! > 7
        ? "due-soon"
        : "ok";

    return {
      id: r.id,
      athleteId: r.athleteId,
      event: r.event,
      gender: r.gender,
      deficitPrimary: r.deficitPrimary,
      deficitStatus: r.deficitStatus,
      overPowered: r.overPowered,
      competitionPb: r.competitionPb,
      trainingPhase: (r as Record<string, unknown>).trainingPhase as string | null,
      athlete: {
        id: r.athlete.id,
        firstName: r.athlete.firstName,
        lastName: r.athlete.lastName,
        avatarUrl: r.athlete.avatarUrl,
        throwsPRs: r.athlete.throwsPRs,
      },
      testingRecords: r.testingRecords,
      testStatus,
      daysSinceTest,
      throwsThisWeek,
      implementSplit: split,
      daysSincePractice,
      lastPracticeDate,
      latestCheckIn: r.athlete.throwsCheckIns[0] ?? null,
      recentBestMark: bestMark14dByAthlete[r.athleteId] ?? null,
    };
  });

  const statusOrder = { never: 0, overdue: 1, "due-soon": 2, ok: 3 };
  data.sort((a, b) => statusOrder[a.testStatus] - statusOrder[b.testStatus]);

  return data;
}

export type ThrowsSessionData = Awaited<ReturnType<typeof getThrowsSessions>>[number];
export type ThrowsRosterPulseRow = Awaited<ReturnType<typeof getThrowsRosterPulse>>[number];
