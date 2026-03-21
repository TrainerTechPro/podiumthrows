import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface TrendPoint {
  date: string;
  event: string;
  distance: number;
  source: string;
}

type ImplBucket = {
  throwCount: number;
  totalDistance: number;
  bestDistance: number;
};

/* ─── GET — aggregate throw analysis data for the authenticated athlete ──── */

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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ── Fetch all data sources in parallel ────────────────────────────────

    const [practiceAttempts, throwLogs, throwsPRs, throwsBlockLogs] =
      await Promise.all([
        // PracticeAttempt — coach-led practice throws
        prisma.practiceAttempt.findMany({
          where: { athleteId: athlete.id },
          select: {
            event: true,
            implement: true,
            distance: true,
            isPR: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        }),

        // ThrowLog — standalone throws (has isCompetition flag)
        prisma.throwLog.findMany({
          where: { athleteId: athlete.id },
          select: {
            event: true,
            implementWeight: true,
            distance: true,
            date: true,
            isPersonalBest: true,
            isCompetition: true,
          },
          orderBy: { date: "asc" },
        }),

        // ThrowsPR — personal records
        prisma.throwsPR.findMany({
          where: { athleteId: athlete.id },
          select: {
            event: true,
            implement: true,
            distance: true,
            achievedAt: true,
            source: true,
          },
          orderBy: { achievedAt: "asc" },
        }),

        // ThrowsBlockLog — structured session throws
        prisma.throwsBlockLog.findMany({
          where: {
            assignment: { athleteId: athlete.id },
          },
          select: {
            distance: true,
            implement: true,
            createdAt: true,
            assignment: {
              select: {
                session: {
                  select: { event: true },
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
      ]);

    // ── Build distance trends ──────────────────────────────────────────────

    const distanceTrends: TrendPoint[] = [];

    // From PracticeAttempt
    for (const pa of practiceAttempts) {
      if (pa.distance != null && pa.distance > 0) {
        distanceTrends.push({
          date: pa.createdAt.toISOString().split("T")[0],
          event: pa.event,
          distance: pa.distance,
          source: "practice",
        });
      }
    }

    // From ThrowLog
    for (const tl of throwLogs) {
      if (tl.distance > 0) {
        distanceTrends.push({
          date: tl.date.toISOString().split("T")[0],
          event: tl.event,
          distance: tl.distance,
          source: tl.isCompetition ? "competition" : "practice",
        });
      }
    }

    // From ThrowsBlockLog
    for (const bl of throwsBlockLogs) {
      if (bl.distance != null && bl.distance > 0) {
        distanceTrends.push({
          date: bl.createdAt.toISOString().split("T")[0],
          event: bl.assignment.session.event,
          distance: bl.distance,
          source: "session",
        });
      }
    }

    // Sort by date
    distanceTrends.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // ── Build PR timeline ──────────────────────────────────────────────────

    const prTimeline = throwsPRs.map((pr) => ({
      event: pr.event,
      implement: pr.implement,
      distance: pr.distance,
      date: pr.achievedAt,
      source: pr.source || "TRAINING",
    }));

    // Sort newest first
    prTimeline.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // ── Build competition vs practice split ────────────────────────────────

    let compCount = 0;
    let compTotal = 0;
    let practiceCount = 0;
    let practiceTotal = 0;

    // ThrowLog has explicit isCompetition
    for (const tl of throwLogs) {
      if (tl.distance > 0) {
        if (tl.isCompetition) {
          compCount++;
          compTotal += tl.distance;
        } else {
          practiceCount++;
          practiceTotal += tl.distance;
        }
      }
    }

    // PracticeAttempts are always practice
    for (const pa of practiceAttempts) {
      if (pa.distance != null && pa.distance > 0) {
        practiceCount++;
        practiceTotal += pa.distance;
      }
    }

    // ThrowsBlockLogs are always practice (from training sessions)
    for (const bl of throwsBlockLogs) {
      if (bl.distance != null && bl.distance > 0) {
        practiceCount++;
        practiceTotal += bl.distance;
      }
    }

    const competitionVsPractice = {
      competition: {
        count: compCount,
        avgDistance:
          compCount > 0
            ? Math.round((compTotal / compCount) * 100) / 100
            : 0,
      },
      practice: {
        count: practiceCount,
        avgDistance:
          practiceCount > 0
            ? Math.round((practiceTotal / practiceCount) * 100) / 100
            : 0,
      },
    };

    // ── Build implement weight distribution ────────────────────────────────

    const implMap = new Map<string, ImplBucket>();

    const addToImplMap = (
      event: string,
      implement: string,
      distance: number
    ) => {
      const key = `${event}||${implement}`;
      const existing = implMap.get(key);
      if (existing) {
        existing.throwCount++;
        existing.totalDistance += distance;
        if (distance > existing.bestDistance) existing.bestDistance = distance;
      } else {
        implMap.set(key, {
          throwCount: 1,
          totalDistance: distance,
          bestDistance: distance,
        });
      }
    };

    for (const pa of practiceAttempts) {
      if (pa.distance != null && pa.distance > 0) {
        addToImplMap(pa.event, pa.implement, pa.distance);
      }
    }

    for (const tl of throwLogs) {
      if (tl.distance > 0) {
        addToImplMap(tl.event, `${tl.implementWeight}kg`, tl.distance);
      }
    }

    for (const bl of throwsBlockLogs) {
      if (bl.distance != null && bl.distance > 0) {
        addToImplMap(bl.assignment.session.event, bl.implement, bl.distance);
      }
    }

    const implementDistribution = Array.from(implMap.entries()).map(
      ([key, bucket]) => {
        const [event, implement] = key.split("||");
        return {
          event,
          implement,
          throwCount: bucket.throwCount,
          avgDistance:
            Math.round((bucket.totalDistance / bucket.throwCount) * 100) / 100,
          bestDistance: Math.round(bucket.bestDistance * 100) / 100,
        };
      }
    );

    // Sort by event then implement
    implementDistribution.sort((a, b) => {
      if (a.event !== b.event) return a.event.localeCompare(b.event);
      return a.implement.localeCompare(b.implement);
    });

    return NextResponse.json({
      distanceTrends,
      prTimeline,
      competitionVsPractice,
      implementDistribution,
    });
  } catch (err) {
    logger.error("GET /api/athlete/throws/analysis", { context: "api", error: err });
    return NextResponse.json(
      { error: "Failed to fetch analysis data." },
      { status: 500 }
    );
  }
}
