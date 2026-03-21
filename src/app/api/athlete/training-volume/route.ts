import { NextResponse } from "next/server";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/* ─── GET — training volume metrics for last 12 weeks ──────────────────────── */

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const now = new Date();
    const twelveWeeksAgo = new Date(now);
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84); // 12 * 7

    // Fetch all data sources in parallel
    const [completedSessions, practiceAttempts, selfLoggedSessions] =
      await Promise.all([
        // Coach-assigned sessions that were completed
        prisma.trainingSession.findMany({
          where: {
            athleteId: athlete.id,
            status: "COMPLETED",
            completedDate: { gte: twelveWeeksAgo },
          },
          select: { completedDate: true },
        }),

        // Practice attempts (throws logged by coach during practice)
        prisma.practiceAttempt.findMany({
          where: {
            athleteId: athlete.id,
            createdAt: { gte: twelveWeeksAgo },
          },
          select: { createdAt: true, drillType: true },
        }),

        // Self-logged athlete throws sessions
        prisma.athleteThrowsSession.findMany({
          where: {
            athleteId: athlete.id,
            createdAt: { gte: twelveWeeksAgo },
          },
          select: {
            date: true,
            createdAt: true,
            drillLogs: {
              select: { throwCount: true, drillType: true },
            },
          },
        }),
      ]);

    // Build weekly volume map (last 12 weeks)
    const weeklyMap = new Map<
      string,
      { weekStart: Date; sessions: number; throws: number }
    >();

    // Initialize all 12 weeks
    for (let i = 11; i >= 0; i--) {
      const weekStart = getWeekStart(
        new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
      );
      const key = weekStart.toISOString();
      weeklyMap.set(key, { weekStart, sessions: 0, throws: 0 });
    }

    // Count completed training sessions per week
    for (const s of completedSessions) {
      if (!s.completedDate) continue;
      const key = getWeekStart(s.completedDate).toISOString();
      const week = weeklyMap.get(key);
      if (week) week.sessions++;
    }

    // Count practice attempt throws per week
    for (const a of practiceAttempts) {
      const key = getWeekStart(a.createdAt).toISOString();
      const week = weeklyMap.get(key);
      if (week) week.throws++;
    }

    // Count self-logged sessions and their throws per week
    for (const s of selfLoggedSessions) {
      const key = getWeekStart(s.createdAt).toISOString();
      const week = weeklyMap.get(key);
      if (week) {
        week.sessions++;
        for (const log of s.drillLogs) {
          week.throws += log.throwCount;
        }
      }
    }

    // Format weekly volume
    const weeklyVolume = Array.from(weeklyMap.values()).map((w) => ({
      week: w.weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      sessions: w.sessions,
      throws: w.throws,
    }));

    // Exercise / drill frequency (from practice attempts + self-logged)
    const drillCounts = new Map<string, number>();

    for (const a of practiceAttempts) {
      const drill = a.drillType || "Full Throw";
      drillCounts.set(drill, (drillCounts.get(drill) || 0) + 1);
    }

    for (const s of selfLoggedSessions) {
      for (const log of s.drillLogs) {
        const drill = log.drillType || "Full Throw";
        drillCounts.set(drill, (drillCounts.get(drill) || 0) + log.throwCount);
      }
    }

    const exerciseFrequency = Array.from(drillCounts.entries())
      .map(([exercise, count]) => ({
        exercise: formatDrillType(exercise),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Streak calculation: consecutive days with at least one session or throw
    const activityDates = new Set<string>();

    for (const s of completedSessions) {
      if (s.completedDate) {
        activityDates.add(toDateString(s.completedDate));
      }
    }
    for (const a of practiceAttempts) {
      activityDates.add(toDateString(a.createdAt));
    }
    for (const s of selfLoggedSessions) {
      // Use the date field (YYYY-MM-DD) if available, else createdAt
      activityDates.add(s.date || toDateString(s.createdAt));
    }

    const { current, longest } = calculateStreaks(activityDates);

    return NextResponse.json({
      weeklyVolume,
      exerciseFrequency,
      streaks: { current, longest },
    });
  } catch (err) {
    logger.error("GET /api/athlete/training-volume", { context: "api", error: err });
    return NextResponse.json(
      { error: "Failed to fetch training volume." },
      { status: 500 }
    );
  }
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

/** Get Monday 00:00 of the ISO week containing the given date */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon ...
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Convert Date to YYYY-MM-DD string */
function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

/** Format drill type enum to human-readable */
function formatDrillType(drill: string): string {
  return drill
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Calculate current and longest streaks from a set of date strings */
function calculateStreaks(dates: Set<string>): {
  current: number;
  longest: number;
} {
  if (dates.size === 0) return { current: 0, longest: 0 };

  const sorted = Array.from(dates).sort();
  const today = toDateString(new Date());

  let longest = 1;
  let currentRun = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

    if (Math.round(diff) === 1) {
      currentRun++;
      longest = Math.max(longest, currentRun);
    } else {
      currentRun = 1;
    }
  }

  // Current streak: must include today or yesterday
  const lastDate = sorted[sorted.length - 1];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toDateString(yesterday);

  let current = 0;
  if (lastDate === today || lastDate === yesterdayStr) {
    current = 1;
    for (let i = sorted.length - 2; i >= 0; i--) {
      const prev = new Date(sorted[i]);
      const next = new Date(sorted[i + 1]);
      const diff = (next.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (Math.round(diff) === 1) {
        current++;
      } else {
        break;
      }
    }
  }

  return { current, longest: Math.max(longest, current) };
}
