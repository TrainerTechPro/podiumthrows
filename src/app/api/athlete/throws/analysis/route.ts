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
  implementKg: number;
  implementLabel: string;
}

/**
 * Parse an implement string like "7.26kg", "800g", "2.0kg" into a numeric kg value.
 * Javelin weights are stored in grams on some log pages; convert to kg.
 * Returns null if the string can't be parsed.
 */
function parseImplementKg(implement: string): number | null {
  if (!implement) return null;
  const trimmed = implement.trim().toLowerCase();
  const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(kg|g|lb|lbs)?$/);
  if (!match) {
    // Fallback: strip non-numeric characters
    const n = parseFloat(implement.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const n = parseFloat(match[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = match[2] ?? "kg";
  if (unit === "g") return n / 1000;
  if (unit === "lb" || unit === "lbs") return n * 0.453592;
  return n;
}

/**
 * Produce a stable display label from a kg value. Rounds to 2 decimals and strips
 * trailing zeros so "7.26kg" stays "7.26kg" but "8.00kg" becomes "8kg".
 */
function formatImplementKg(kg: number): string {
  const rounded = Math.round(kg * 100) / 100;
  return `${rounded.toString().replace(/\.00?$/, "")}kg`;
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
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, gender: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    // ── Fetch all data sources in parallel ────────────────────────────────

    const [practiceAttempts, throwLogs, athleteImplementPRs, throwsBlockLogs, athleteDrillLogs] =
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

        // AthleteImplementPR — catalog-keyed PRs (one row per
        // (athlete, implement)). Uniqueness constraint structurally prevents
        // the duplicate-label problem that plagued ThrowsPR. Sources both
        // ThrowLog AND AthleteDrillLog data via recomputeAthleteImplementPR.
        prisma.athleteImplementPR.findMany({
          where: { athleteId: athlete.id, bestDistance: { not: null } },
          orderBy: { bestAchievedAt: "desc" },
          include: {
            implement: {
              select: { throwType: true, displayLabel: true, weightKg: true },
            },
          },
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

        // AthleteDrillLog — self-logged session drills via /athlete/log-session.
        // PRs from these rows land in ThrowsPR (via recordThrow at POST time) but
        // the drill rows themselves were previously missing from this aggregate,
        // which is why the Trends chart clipped against the latest practice PR.
        // bestMark is canonical meters; implementWeight is canonical kg.
        prisma.athleteDrillLog.findMany({
          where: {
            session: { athleteId: athlete.id },
            bestMark: { not: null, gt: 0 },
            implementWeight: { not: null, gt: 0 },
          },
          select: {
            bestMark: true,
            implementWeight: true,
            session: { select: { event: true, date: true } },
          },
          orderBy: { createdAt: "asc" },
        }),
      ]);

    // ── Build distance trends ──────────────────────────────────────────────

    const distanceTrends: TrendPoint[] = [];

    // From PracticeAttempt
    for (const pa of practiceAttempts) {
      if (pa.distance != null && pa.distance > 0) {
        const implementKg = parseImplementKg(pa.implement);
        if (implementKg == null) continue;
        distanceTrends.push({
          date: pa.createdAt.toISOString().split("T")[0],
          event: pa.event,
          distance: pa.distance,
          source: "practice",
          implementKg,
          implementLabel: formatImplementKg(implementKg),
        });
      }
    }

    // From ThrowLog
    for (const tl of throwLogs) {
      if (tl.distance != null && tl.distance > 0 && tl.implementWeight > 0) {
        distanceTrends.push({
          date: tl.date.toISOString().split("T")[0],
          event: tl.event,
          distance: tl.distance,
          source: tl.isCompetition ? "competition" : "practice",
          implementKg: tl.implementWeight,
          implementLabel: formatImplementKg(tl.implementWeight),
        });
      }
    }

    // From ThrowsBlockLog
    for (const bl of throwsBlockLogs) {
      if (bl.distance != null && bl.distance > 0) {
        const implementKg = parseImplementKg(bl.implement);
        if (implementKg == null) continue;
        distanceTrends.push({
          date: bl.createdAt.toISOString().split("T")[0],
          event: bl.assignment.session.event,
          distance: bl.distance,
          source: "session",
          implementKg,
          implementLabel: formatImplementKg(implementKg),
        });
      }
    }

    // From AthleteDrillLog — self-logged sessions. The `where` already filters
    // nulls and zeros, but TS doesn't narrow Prisma conditional nullability,
    // so guard again here for the type checker.
    for (const dl of athleteDrillLogs) {
      if (dl.bestMark == null || dl.bestMark <= 0) continue;
      if (dl.implementWeight == null || dl.implementWeight <= 0) continue;
      distanceTrends.push({
        date: dl.session.date, // already "YYYY-MM-DD"
        event: dl.session.event,
        distance: dl.bestMark,
        source: "session",
        implementKg: dl.implementWeight,
        implementLabel: formatImplementKg(dl.implementWeight),
      });
    }

    // Sort by date
    distanceTrends.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // ── Build PR timeline ──────────────────────────────────────────────────
    //
    // Reads from AthleteImplementPR (catalog-keyed, one row per
    // (athlete, implement) by uniqueness constraint). This is what
    // structurally fixes the "same throw shown 3 times under different
    // labels" bug that the legacy ThrowsPR table couldn't avoid.
    //
    // Implements that aren't yet catalog-assigned (rare — backfill resolves
    // most) silently fall through here. Athletes with unresolved cases see
    // them in the Fix Old Throws UI banner.

    const eventFromImplementType = (t: "HAMMER" | "SHOT" | "DISCUS" | "JAVELIN"): string =>
      t === "SHOT" ? "SHOT_PUT" : t;

    const prTimeline = athleteImplementPRs
      .filter((pr) => pr.bestDistance != null && pr.bestAchievedAt != null)
      .map((pr) => ({
        event: eventFromImplementType(pr.implement.throwType),
        implement: pr.implement.displayLabel,
        distance: pr.bestDistance!,
        date: pr.bestAchievedAt!.toISOString().slice(0, 10),
        source: pr.bestContext === "COMPETITION" ? "COMPETITION" : "TRAINING",
      }));

    // Sort newest first.
    prTimeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // ── Build competition vs practice split ────────────────────────────────

    let compCount = 0;
    let compTotal = 0;
    let practiceCount = 0;
    let practiceTotal = 0;

    // ThrowLog has explicit isCompetition
    for (const tl of throwLogs) {
      if (tl.distance != null && tl.distance > 0) {
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
        avgDistance: compCount > 0 ? Math.round((compTotal / compCount) * 100) / 100 : 0,
      },
      practice: {
        count: practiceCount,
        avgDistance:
          practiceCount > 0 ? Math.round((practiceTotal / practiceCount) * 100) / 100 : 0,
      },
    };

    // ── Build implement weight distribution ────────────────────────────────

    const implMap = new Map<string, ImplBucket>();

    const addToImplMap = (event: string, implement: string, distance: number) => {
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
      if (tl.distance != null && tl.distance > 0) {
        addToImplMap(tl.event, `${tl.implementWeight}kg`, tl.distance);
      }
    }

    for (const bl of throwsBlockLogs) {
      if (bl.distance != null && bl.distance > 0) {
        addToImplMap(bl.assignment.session.event, bl.implement, bl.distance);
      }
    }

    // Include self-logged drills in the implement distribution too so the
    // bottom "Throw count and distances by implement weight" section isn't
    // inconsistent with the chart above.
    for (const dl of athleteDrillLogs) {
      if (dl.bestMark == null || dl.bestMark <= 0) continue;
      if (dl.implementWeight == null || dl.implementWeight <= 0) continue;
      addToImplMap(dl.session.event, `${dl.implementWeight}kg`, dl.bestMark);
    }

    const implementDistribution = Array.from(implMap.entries()).map(([key, bucket]) => {
      const [event, implement] = key.split("||");
      return {
        event,
        implement,
        throwCount: bucket.throwCount,
        avgDistance: Math.round((bucket.totalDistance / bucket.throwCount) * 100) / 100,
        bestDistance: Math.round(bucket.bestDistance * 100) / 100,
      };
    });

    // Sort by event then implement
    implementDistribution.sort((a, b) => {
      if (a.event !== b.event) return a.event.localeCompare(b.event);
      return a.implement.localeCompare(b.implement);
    });

    return NextResponse.json({
      success: true,
      data: {
        athleteId: athlete.id,
        gender: athlete.gender,
        distanceTrends,
        prTimeline,
        competitionVsPractice,
        implementDistribution,
      },
    });
  } catch (err) {
    logger.error("GET /api/athlete/throws/analysis", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to fetch analysis data." },
      { status: 500 }
    );
  }
}
