import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const now = new Date();
    const twelveWeeksAgo = new Date(now);
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const sessions = await prisma.coachThrowsSession.findMany({
      where: {
        coachId: coach.id,
        createdAt: { gte: twelveWeeksAgo },
      },
      select: {
        date: true,
        createdAt: true,
        sessionRpe: true,
        drillLogs: {
          select: { throwCount: true, drillType: true, implementWeight: true, bestMark: true },
        },
      },
    });

    // Weekly volume map
    const weeklyMap = new Map<
      string,
      { weekStart: Date; sessions: number; throws: number }
    >();

    for (let i = 11; i >= 0; i--) {
      const weekStart = getWeekStart(
        new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
      );
      const key = weekStart.toISOString();
      weeklyMap.set(key, { weekStart, sessions: 0, throws: 0 });
    }

    // RPE trend data
    const rpeTrend: { label: string; value: number }[] = [];

    // Distance trends per implement
    const distanceByImpl = new Map<string, { label: string; value: number }[]>();

    for (const s of sessions) {
      const key = getWeekStart(s.createdAt).toISOString();
      const week = weeklyMap.get(key);
      if (week) {
        week.sessions++;
        for (const log of s.drillLogs) {
          week.throws += log.throwCount;
        }
      }

      // RPE trend
      if (s.sessionRpe) {
        rpeTrend.push({
          label: s.date || toDateString(s.createdAt),
          value: s.sessionRpe,
        });
      }

      // Distance trends by implement
      for (const log of s.drillLogs) {
        if (log.bestMark && log.bestMark > 0 && log.implementWeight) {
          const implKey = `${log.implementWeight}kg`;
          if (!distanceByImpl.has(implKey)) {
            distanceByImpl.set(implKey, []);
          }
          distanceByImpl.get(implKey)!.push({
            label: s.date || toDateString(s.createdAt),
            value: log.bestMark,
          });
        }
      }
    }

    const weeklyVolume = Array.from(weeklyMap.values()).map((w) => ({
      week: w.weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      sessions: w.sessions,
      throws: w.throws,
    }));

    // Drill frequency
    const drillCounts = new Map<string, number>();
    for (const s of sessions) {
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

    // Streaks
    const activityDates = new Set<string>();
    for (const s of sessions) {
      activityDates.add(s.date || toDateString(s.createdAt));
    }
    const streaks = calculateStreaks(activityDates);

    // Distance trends formatted as series
    const distanceTrends = Array.from(distanceByImpl.entries()).map(
      ([impl, data]) => ({
        implement: impl,
        data,
      })
    );

    return NextResponse.json({
      weeklyVolume,
      exerciseFrequency,
      streaks,
      rpeTrend,
      distanceTrends,
    });
  } catch (err) {
    logger.error("GET /api/coach/my-training/volume", { context: "api", error: err });
    return NextResponse.json(
      { error: "Failed to fetch training volume." },
      { status: 500 }
    );
  }
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDrillType(drill: string): string {
  return drill
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

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
