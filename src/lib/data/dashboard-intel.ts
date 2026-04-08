/**
 * dashboard-intel.ts
 *
 * Three data functions powering the reimagined coach dashboard:
 *   1. getRecentTeamPRs()      — recent PRs across the roster
 *   2. getTeamLoadOverview()   — per-athlete throw volume, ACWR, adaptation, deficits
 *   3. getUpcomingCompetitions() — A/B-priority competitions within 60 days
 *
 * All exports are wrapped in React cache() so duplicate calls within a single
 * server render tree only fire once.
 */

import { cache } from "react";
import prisma from "@/lib/prisma";
import { getLocalDate, getCoachTimezone, combineLocalDateTime, startOfToday } from "@/lib/dates";

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function todayISO(timezone: string): string {
  return getLocalDate(timezone);
}

function daysAgoISO(timezone: string, n: number): string {
  const offset = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return getLocalDate(timezone, offset);
}

function daysFromNowISO(timezone: string, n: number): string {
  const offset = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  return getLocalDate(timezone, offset);
}

/** Number of calendar days between a YYYY-MM-DD string and today in the given timezone. */
function daysBetween(dateStr: string, timezone: string): number {
  const target = combineLocalDateTime(dateStr, "00:00", timezone);
  const todayStart = startOfToday(timezone);
  return Math.round((target.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
}

/* ─── 1. getRecentTeamPRs ─────────────────────────────────────────────────── */

export interface TeamPR {
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  event: string;
  implement: string;
  distance: number;
  date: string;
  source: "TRAINING" | "COMPETITION" | null;
}

export const getRecentTeamPRs = cache(
  async (coachId: string, days: number = 14): Promise<TeamPR[]> => {
    const tz = await getCoachTimezone(coachId);
    const cutoff = daysAgoISO(tz, days);

    const [throwsPRs, drillPRs] = await Promise.all([
      prisma.throwsPR.findMany({
        where: {
          achievedAt: { gte: cutoff },
          athlete: { coachId },
        },
        select: {
          athleteId: true,
          event: true,
          implement: true,
          distance: true,
          achievedAt: true,
          source: true,
          athlete: {
            select: { firstName: true, lastName: true, avatarUrl: true },
          },
        },
        orderBy: { achievedAt: "desc" },
      }),
      prisma.throwsDrillPR.findMany({
        where: {
          achievedAt: { gte: cutoff },
          athlete: { coachId },
        },
        select: {
          athleteId: true,
          event: true,
          drillType: true,
          implement: true,
          distance: true,
          achievedAt: true,
          athlete: {
            select: { firstName: true, lastName: true, avatarUrl: true },
          },
        },
        orderBy: { achievedAt: "desc" },
      }),
    ]);

    const merged: TeamPR[] = [
      ...throwsPRs.map((pr) => ({
        athleteId: pr.athleteId,
        athleteName: `${pr.athlete.firstName} ${pr.athlete.lastName}`,
        avatarUrl: pr.athlete.avatarUrl,
        event: pr.event,
        implement: pr.implement,
        distance: pr.distance,
        date: pr.achievedAt,
        source: (pr.source as "TRAINING" | "COMPETITION") ?? null,
      })),
      ...drillPRs.map((pr) => ({
        athleteId: pr.athleteId,
        athleteName: `${pr.athlete.firstName} ${pr.athlete.lastName}`,
        avatarUrl: pr.athlete.avatarUrl,
        event: `${pr.event} (${pr.drillType})`,
        implement: pr.implement,
        distance: pr.distance,
        date: pr.achievedAt,
        source: null as "TRAINING" | "COMPETITION" | null,
      })),
    ];

    // Sort descending by date, take top 10
    merged.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
    return merged.slice(0, 10);
  }
);

/* ─── 2. getTeamLoadOverview ──────────────────────────────────────────────── */

export interface TeamLoadEntry {
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  throwsThisWeek: number;
  acwr: number | null;
  riskLevel: "low" | "moderate" | "high" | null;
  adaptationPhase: string | null;
  deficitClassification: string | null;
  sessionsToForm: number | null;
}

export const getTeamLoadOverview = cache(
  async (coachId: string): Promise<TeamLoadEntry[]> => {
    // 1. Get all roster athletes
    const athletes = await prisma.athleteProfile.findMany({
      where: { coachId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });

    if (athletes.length === 0) return [];

    const athleteIds = athletes.map((a) => a.id);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 2. Parallel queries for volume + risk + adaptation + profile + typing
    const [
      blockLogs,
      practiceAttempts,
      drillLogs,
      riskAssessments,
      adaptationCheckpoints,
      throwsProfiles,
      throwsTypings,
    ] = await Promise.all([
      // ThrowsBlockLog — need to resolve assignmentId -> ThrowsAssignment.athleteId
      prisma.throwsBlockLog.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
          assignment: { athleteId: { in: athleteIds } },
        },
        select: {
          id: true,
          assignment: { select: { athleteId: true } },
        },
      }),

      // PracticeAttempt — direct athleteId
      prisma.practiceAttempt.groupBy({
        by: ["athleteId"],
        where: {
          athleteId: { in: athleteIds },
          createdAt: { gte: sevenDaysAgo },
        },
        _count: { id: true },
      }),

      // AthleteDrillLog — resolve sessionId -> AthleteThrowsSession.athleteId
      prisma.athleteDrillLog.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
          session: { athleteId: { in: athleteIds } },
        },
        select: {
          throwCount: true,
          session: { select: { athleteId: true } },
        },
      }),

      // Latest RiskAssessment per athlete
      prisma.riskAssessment.findMany({
        where: { athleteId: { in: athleteIds } },
        orderBy: { createdAt: "desc" },
        distinct: ["athleteId"],
        select: {
          athleteId: true,
          acwr: true,
          riskLevel: true,
        },
      }),

      // Latest AdaptationCheckpoint per athlete via program.athleteId
      prisma.adaptationCheckpoint.findMany({
        where: {
          program: { athleteId: { in: athleteIds } },
        },
        orderBy: { checkDate: "desc" },
        distinct: ["programId"],
        select: {
          recommendation: true,
          program: { select: { athleteId: true } },
        },
      }),

      // ThrowsProfile — deficit classification
      prisma.throwsProfile.findMany({
        where: { athleteId: { in: athleteIds } },
        select: {
          athleteId: true,
          deficitStatus: true,
          overPowered: true,
          muscledOut: true,
        },
      }),

      // ThrowsTyping — estimatedSessionsToForm
      prisma.throwsTyping.findMany({
        where: { athleteId: { in: athleteIds } },
        select: {
          athleteId: true,
          estimatedSessionsToForm: true,
        },
      }),
    ]);

    // 3. Aggregate throw volume per athlete

    // Block logs: count per athlete
    const blockCountMap = new Map<string, number>();
    for (const log of blockLogs) {
      const aid = log.assignment.athleteId;
      blockCountMap.set(aid, (blockCountMap.get(aid) ?? 0) + 1);
    }

    // Practice attempts: already grouped
    const practiceCountMap = new Map<string, number>();
    for (const row of practiceAttempts) {
      practiceCountMap.set(row.athleteId, row._count.id);
    }

    // Drill logs: sum throwCount per athlete
    const drillCountMap = new Map<string, number>();
    for (const log of drillLogs) {
      const aid = log.session.athleteId;
      drillCountMap.set(aid, (drillCountMap.get(aid) ?? 0) + log.throwCount);
    }

    // 4. Build lookup maps

    const riskMap = new Map(riskAssessments.map((r) => [r.athleteId, r]));

    // Adaptation: deduplicate to latest per athlete (distinct is per programId, not athleteId)
    const adaptationMap = new Map<string, string>();
    for (const cp of adaptationCheckpoints) {
      const aid = cp.program.athleteId;
      if (aid && !adaptationMap.has(aid)) {
        adaptationMap.set(aid, cp.recommendation);
      }
    }

    const profileMap = new Map(throwsProfiles.map((p) => [p.athleteId, p]));
    const typingMap = new Map(throwsTypings.map((t) => [t.athleteId, t]));

    // 5. Assemble entries
    const entries: TeamLoadEntry[] = athletes.map((athlete) => {
      const throwsThisWeek =
        (blockCountMap.get(athlete.id) ?? 0) +
        (practiceCountMap.get(athlete.id) ?? 0) +
        (drillCountMap.get(athlete.id) ?? 0);

      // Risk
      const risk = riskMap.get(athlete.id);
      let acwr: number | null = null;
      let riskLevel: "low" | "moderate" | "high" | null = null;
      if (risk) {
        acwr = risk.acwr;
        if (risk.acwr > 1.3) riskLevel = "high";
        else if (risk.acwr > 1.0) riskLevel = "moderate";
        else riskLevel = "low";
      }

      // Adaptation phase
      let adaptationPhase: string | null = null;
      const rec = adaptationMap.get(athlete.id);
      if (rec) {
        if (rec === "ADVANCE_PHASE") adaptationPhase = "in-form";
        else if (rec === "DELOAD" || rec === "REDUCE_VOLUME")
          adaptationPhase = "readaptation-risk";
        else if (rec === "IMPROVING") adaptationPhase = "adapting";
        else adaptationPhase = "loading";
      }

      // Deficit classification
      let deficitClassification: string | null = null;
      const profile = profileMap.get(athlete.id);
      if (profile) {
        if (profile.muscledOut) deficitClassification = "Muscled Out";
        else if (profile.overPowered) deficitClassification = "Over-powered";
        else deficitClassification = profile.deficitStatus ?? null;
      }

      // Sessions to form
      const typing = typingMap.get(athlete.id);
      const sessionsToForm = typing?.estimatedSessionsToForm ?? null;

      return {
        athleteId: athlete.id,
        athleteName: `${athlete.firstName} ${athlete.lastName}`,
        avatarUrl: athlete.avatarUrl,
        throwsThisWeek,
        acwr,
        riskLevel,
        adaptationPhase,
        deficitClassification,
        sessionsToForm,
      };
    });

    // 6. Sort: high risk first, then moderate, then low, then null
    const riskOrder: Record<string, number> = {
      high: 0,
      moderate: 1,
      low: 2,
    };
    entries.sort((a, b) => {
      const aOrder = a.riskLevel != null ? riskOrder[a.riskLevel] : 3;
      const bOrder = b.riskLevel != null ? riskOrder[b.riskLevel] : 3;
      return aOrder - bOrder;
    });

    return entries;
  }
);

/* ─── 3. getUpcomingCompetitions ──────────────────────────────────────────── */

export interface UpcomingCompetition {
  id: string;
  name: string;
  event: string;
  date: string;
  daysOut: number;
  priority: "A" | "B";
  athletes: { id: string; name: string; avatarUrl: string | null }[];
  taperWeek: number | null; // 1-3 if within 21 days
}

export const getUpcomingCompetitions = cache(
  async (coachId: string): Promise<UpcomingCompetition[]> => {
    const tz = await getCoachTimezone(coachId);
    const today = todayISO(tz);
    const sixtyDaysOut = daysFromNowISO(tz, 60);

    const competitions = await prisma.throwsCompetition.findMany({
      where: {
        date: { gte: today, lte: sixtyDaysOut },
        priority: { in: ["A", "B"] },
        athlete: { coachId },
      },
      select: {
        id: true,
        name: true,
        event: true,
        date: true,
        priority: true,
        athleteId: true,
        athlete: {
          select: { firstName: true, lastName: true, avatarUrl: true },
        },
      },
      orderBy: { date: "asc" },
    });

    // Group by name + date (multiple athletes may share one competition)
    const groupKey = (c: { name: string; date: string }) =>
      `${c.name}|||${c.date}`;

    const grouped = new Map<
      string,
      {
        id: string;
        name: string;
        event: string;
        date: string;
        priority: "A" | "B";
        athletes: { id: string; name: string; avatarUrl: string | null }[];
      }
    >();

    for (const comp of competitions) {
      const key = groupKey(comp);
      const existing = grouped.get(key);

      if (existing) {
        // Add athlete if not already present
        if (!existing.athletes.some((a) => a.id === comp.athleteId)) {
          existing.athletes.push({
            id: comp.athleteId,
            name: `${comp.athlete.firstName} ${comp.athlete.lastName}`,
            avatarUrl: comp.athlete.avatarUrl,
          });
        }
        // Promote to A if any entry is A
        if (comp.priority === "A") {
          existing.priority = "A";
        }
      } else {
        grouped.set(key, {
          id: comp.id,
          name: comp.name,
          event: comp.event,
          date: comp.date,
          priority: comp.priority as "A" | "B",
          athletes: [
            {
              id: comp.athleteId,
              name: `${comp.athlete.firstName} ${comp.athlete.lastName}`,
              avatarUrl: comp.athlete.avatarUrl,
            },
          ],
        });
      }
    }

    // Build final array with daysOut and taperWeek
    const results: UpcomingCompetition[] = [];

    for (const entry of grouped.values()) {
      const daysOut = daysBetween(entry.date, tz);

      let taperWeek: number | null = null;
      if (daysOut <= 21) {
        taperWeek = Math.min(3, Math.max(1, Math.ceil((21 - daysOut) / 7)));
      }

      results.push({
        id: entry.id,
        name: entry.name,
        event: entry.event,
        date: entry.date,
        daysOut,
        priority: entry.priority,
        athletes: entry.athletes,
        taperWeek,
      });
    }

    // Already sorted by date from the query, but ensure it
    results.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

    return results;
  }
);

/* ─── 4. getTeamDistanceDelta ──────────────────────────────────────────────── */

export interface TeamDistanceDelta {
  avgDeltaPercent: number;
  athleteCount: number;
  totalAthletes: number;
}

/**
 * Compares each athlete's best throw in the last `days` to their best throw
 * in the prior equivalent period. Returns the team-average % change.
 */
export const getTeamDistanceDelta = cache(
  async (coachId: string, days: number = 30): Promise<TeamDistanceDelta> => {
    const athletes = await prisma.athleteProfile.findMany({
      where: { coachId },
      select: { id: true },
    });

    if (athletes.length === 0) {
      return { avgDeltaPercent: 0, athleteCount: 0, totalAthletes: 0 };
    }

    const athleteIds = athletes.map((a) => a.id);
    const now = new Date();
    const recentCutoff = new Date(now);
    recentCutoff.setDate(recentCutoff.getDate() - days);
    const baselineCutoff = new Date(now);
    baselineCutoff.setDate(baselineCutoff.getDate() - days * 2);

    const [recentLogs, baselineLogs] = await Promise.all([
      prisma.throwsBlockLog.findMany({
        where: {
          distance: { not: null },
          createdAt: { gte: recentCutoff },
          assignment: { athleteId: { in: athleteIds } },
        },
        select: {
          distance: true,
          assignment: { select: { athleteId: true } },
        },
      }),
      prisma.throwsBlockLog.findMany({
        where: {
          distance: { not: null },
          createdAt: { gte: baselineCutoff, lt: recentCutoff },
          assignment: { athleteId: { in: athleteIds } },
        },
        select: {
          distance: true,
          assignment: { select: { athleteId: true } },
        },
      }),
    ]);

    const recentBest = new Map<string, number>();
    for (const log of recentLogs) {
      const aid = log.assignment.athleteId;
      const d = log.distance!;
      if (!recentBest.has(aid) || d > recentBest.get(aid)!) {
        recentBest.set(aid, d);
      }
    }

    const baselineBest = new Map<string, number>();
    for (const log of baselineLogs) {
      const aid = log.assignment.athleteId;
      const d = log.distance!;
      if (!baselineBest.has(aid) || d > baselineBest.get(aid)!) {
        baselineBest.set(aid, d);
      }
    }

    let totalDelta = 0;
    let count = 0;
    for (const [aid, recent] of recentBest) {
      const baseline = baselineBest.get(aid);
      if (baseline && baseline > 0) {
        totalDelta += ((recent - baseline) / baseline) * 100;
        count++;
      }
    }

    return {
      avgDeltaPercent: count > 0 ? totalDelta / count : 0,
      athleteCount: count,
      totalAthletes: athletes.length,
    };
  }
);

/* ─── 5. getWeeklyVolumeBreakdown ──────────────────────────────────────────── */

export interface WeeklyVolume {
  days: { label: string; throws: number; date: string }[];
  todayIndex: number;
}

/** Index of a date within the week starting at Monday (0=Mon … 6=Sun). */
function weekdayIndex(date: Date, monday: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const m = new Date(monday);
  m.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - m.getTime()) / (1000 * 60 * 60 * 24));
}

export const getWeeklyVolumeBreakdown = cache(
  async (coachId: string): Promise<WeeklyVolume> => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon …
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(monday.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 7);

    const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const todayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const buildResult = (counts: number[]): WeeklyVolume => ({
      days: DAY_LABELS.map((label, i) => {
        const date = new Date(monday);
        date.setDate(date.getDate() + i);
        return { label, throws: counts[i], date: date.toISOString().slice(0, 10) };
      }),
      todayIndex: todayIdx,
    });

    const athletes = await prisma.athleteProfile.findMany({
      where: { coachId },
      select: { id: true },
    });

    if (athletes.length === 0) return buildResult([0, 0, 0, 0, 0, 0, 0]);

    const athleteIds = athletes.map((a) => a.id);

    const [blockLogs, practiceAttempts, drillLogs] = await Promise.all([
      prisma.throwsBlockLog.findMany({
        where: {
          createdAt: { gte: monday, lt: sunday },
          assignment: { athleteId: { in: athleteIds } },
        },
        select: { createdAt: true },
      }),
      prisma.practiceAttempt.findMany({
        where: {
          createdAt: { gte: monday, lt: sunday },
          athleteId: { in: athleteIds },
        },
        select: { createdAt: true },
      }),
      prisma.athleteDrillLog.findMany({
        where: {
          createdAt: { gte: monday, lt: sunday },
          session: { athleteId: { in: athleteIds } },
        },
        select: { throwCount: true, createdAt: true },
      }),
    ]);

    const counts = [0, 0, 0, 0, 0, 0, 0];

    for (const log of blockLogs) {
      const idx = weekdayIndex(log.createdAt, monday);
      if (idx >= 0 && idx < 7) counts[idx]++;
    }
    for (const attempt of practiceAttempts) {
      const idx = weekdayIndex(attempt.createdAt, monday);
      if (idx >= 0 && idx < 7) counts[idx]++;
    }
    for (const drill of drillLogs) {
      const idx = weekdayIndex(drill.createdAt, monday);
      if (idx >= 0 && idx < 7) counts[idx] += drill.throwCount;
    }

    return buildResult(counts);
  }
);

/* ─── 6. getSeasonGains ────────────────────────────────────────────────────── */

export interface SeasonGainEntry {
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  event: string;
  deltaMeters: number;
  recentBest: number;
}

/**
 * Top athletes by absolute distance improvement.
 * Compares best throw in the last `days` to best throw before that period,
 * per athlete+event combination. Returns the single best event gain per athlete.
 */
export const getSeasonGains = cache(
  async (
    coachId: string,
    days: number = 30,
    limit: number = 5
  ): Promise<SeasonGainEntry[]> => {
    const athletes = await prisma.athleteProfile.findMany({
      where: { coachId },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });

    if (athletes.length === 0) return [];

    const athleteIds = athletes.map((a) => a.id);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const [recentLogs, baselineLogs] = await Promise.all([
      prisma.throwsBlockLog.findMany({
        where: {
          distance: { not: null },
          createdAt: { gte: cutoff },
          assignment: { athleteId: { in: athleteIds } },
        },
        select: {
          distance: true,
          assignment: { select: { athleteId: true } },
          block: { select: { session: { select: { event: true } } } },
        },
      }),
      prisma.throwsBlockLog.findMany({
        where: {
          distance: { not: null },
          createdAt: { lt: cutoff },
          assignment: { athleteId: { in: athleteIds } },
        },
        select: {
          distance: true,
          assignment: { select: { athleteId: true } },
          block: { select: { session: { select: { event: true } } } },
        },
      }),
    ]);

    // Best throw per athlete+event in each period
    const recentBestMap = new Map<string, { distance: number; event: string }>();
    for (const log of recentLogs) {
      const aid = log.assignment.athleteId;
      const event = log.block.session.event;
      const key = `${aid}:${event}`;
      const d = log.distance!;
      const existing = recentBestMap.get(key);
      if (!existing || d > existing.distance) {
        recentBestMap.set(key, { distance: d, event });
      }
    }

    const baselineBestMap = new Map<string, number>();
    for (const log of baselineLogs) {
      const aid = log.assignment.athleteId;
      const event = log.block.session.event;
      const key = `${aid}:${event}`;
      const d = log.distance!;
      if (!baselineBestMap.has(key) || d > baselineBestMap.get(key)!) {
        baselineBestMap.set(key, d);
      }
    }

    // Find best improvement per athlete across all events
    const athleteMap = new Map(athletes.map((a) => [a.id, a]));
    const allGains: {
      aid: string;
      event: string;
      delta: number;
      recentBest: number;
    }[] = [];

    for (const [key, recent] of recentBestMap) {
      const baseline = baselineBestMap.get(key);
      if (baseline && baseline > 0) {
        const aid = key.split(":")[0];
        allGains.push({
          aid,
          event: recent.event,
          delta: recent.distance - baseline,
          recentBest: recent.distance,
        });
      }
    }

    // Sort by delta descending, deduplicate per athlete
    allGains.sort((a, b) => b.delta - a.delta);
    const seen = new Set<string>();
    const result: SeasonGainEntry[] = [];

    for (const g of allGains) {
      if (seen.has(g.aid) || g.delta <= 0) continue;
      seen.add(g.aid);
      const athlete = athleteMap.get(g.aid);
      if (!athlete) continue;

      result.push({
        athleteId: g.aid,
        athleteName: `${athlete.firstName} ${athlete.lastName}`,
        avatarUrl: athlete.avatarUrl,
        event: g.event,
        deltaMeters: g.delta,
        recentBest: g.recentBest,
      });

      if (result.length >= limit) break;
    }

    return result;
  }
);
