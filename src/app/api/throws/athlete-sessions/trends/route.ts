import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { formatImplementWeight } from "@/lib/throws";

// GET /api/throws/athlete-sessions/trends?athleteId=...&event=...
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");
    const event = searchParams.get("event") ?? undefined;

    if (!athleteId) {
      return NextResponse.json({ success: false, error: "athleteId is required" }, { status: 400 });
    }

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const sessions = await prisma.athleteThrowsSession.findMany({
      where: { athleteId, ...(event ? { event } : {}) },
      include: { drillLogs: true },
      orderBy: { date: "asc" },
    });

    type TrendPoint = { date: string; bestMark: number; throwCount: number };
    const seriesMap: Record<string, TrendPoint[]> = {};

    for (const session of sessions) {
      for (const log of session.drillLogs) {
        if (log.bestMark == null) continue;
        // Display the implement using the original unit+value the user entered.
        // e.g. user logs 14lbs → stored as 6.3503…kg but rendered as "14lbs".
        // Using the formatted string as the grouping key also collapses near-duplicates
        // caused by raw float precision (6.350300732098956kg vs 6.35kg etc).
        const impl = log.implementWeight != null
          ? formatImplementWeight(log.implementWeight, log.implementWeightUnit, log.implementWeightOriginal)
          : "?kg";
        const key = `${log.drillType}|${impl}`;
        if (!seriesMap[key]) seriesMap[key] = [];
        seriesMap[key].push({ date: session.date, bestMark: log.bestMark, throwCount: log.throwCount });
      }
    }

    const volumeByDate: Record<string, number> = {};
    for (const session of sessions) {
      const total = session.drillLogs.reduce((s, d) => s + d.throwCount, 0);
      volumeByDate[session.date] = (volumeByDate[session.date] ?? 0) + total;
    }

    const trends = Object.entries(seriesMap).map(([key, points]) => {
      const [drillType, implement] = key.split("|");
      return { key, drillType, implement, points };
    });

    return NextResponse.json({ success: true, data: { trends, volumeByDate, sessionCount: sessions.length } });
  } catch (err) {
    logger.error("athlete-sessions/trends GET error", { context: "throws/athlete-sessions/trends", error: err });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
