import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { validateWeightDifferential } from "@/lib/bondarchuk";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, preferences: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const prefs = JSON.parse(coach.preferences || "{}");
    const gender: "male" | "female" = prefs.myTraining?.gender || "male";

    // Fetch all sessions with drill logs
    const sessions = await prisma.coachThrowsSession.findMany({
      where: { coachId: coach.id },
      select: {
        event: true,
        drillLogs: {
          select: { implementWeight: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // Implement weight distribution
    const implCounts = new Map<string, number>();
    let totalImplEntries = 0;
    for (const s of sessions) {
      for (const dl of s.drillLogs) {
        if (dl.implementWeight) {
          const key = `${dl.implementWeight}kg`;
          implCounts.set(key, (implCounts.get(key) || 0) + 1);
          totalImplEntries++;
        }
      }
    }

    const implementDistribution = Array.from(implCounts.entries())
      .map(([implement, count]) => ({
        implement,
        count,
        percentage: totalImplEntries > 0 ? Math.round((count / totalImplEntries) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Sequencing compliance (ascending violations)
    let totalSessionsWithMultipleWeights = 0;
    let sessionsWithViolations = 0;
    for (const s of sessions) {
      const weights = s.drillLogs
        .map((dl) => dl.implementWeight)
        .filter((w): w is number => w != null);
      if (weights.length < 2) continue;

      totalSessionsWithMultipleWeights++;
      let hasViolation = false;
      for (let i = 1; i < weights.length; i++) {
        if (weights[i] > weights[i - 1]) {
          hasViolation = true;
          break;
        }
      }
      if (hasViolation) sessionsWithViolations++;
    }

    const sequencingCompliance = {
      totalSessions: totalSessionsWithMultipleWeights,
      violations: sessionsWithViolations,
      complianceRate:
        totalSessionsWithMultipleWeights > 0
          ? Math.round(
              ((totalSessionsWithMultipleWeights - sessionsWithViolations) /
                totalSessionsWithMultipleWeights) *
                100
            )
          : 100,
    };

    // Weight differential warnings
    const differentialWarnings: { implement: string; event: string; message: string }[] = [];
    const checkedPairs = new Set<string>();
    for (const s of sessions) {
      for (const dl of s.drillLogs) {
        if (!dl.implementWeight) continue;
        const pairKey = `${s.event}-${dl.implementWeight}`;
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        const result = validateWeightDifferential(dl.implementWeight, s.event, gender);
        for (const w of result.warnings) {
          differentialWarnings.push({
            implement: `${dl.implementWeight}kg`,
            event: s.event,
            message: w.message,
          });
        }
      }
    }

    return NextResponse.json({
      implementDistribution,
      sequencingCompliance,
      differentialWarnings,
    });
  } catch (err) {
    logger.error("GET /api/coach/my-training/analysis", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to fetch analysis" }, { status: 500 });
  }
}
