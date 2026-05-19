import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseQuery } from "@/lib/api-schemas";
import { PerformanceTestTrendQuerySchema } from "@/lib/performance-tests-schemas";

type RouteCtx = { params: Promise<{ athleteId: string; testTypeKey: string }> };

/* ── GET — chart-shaped trend series, ordered ascending by performedAt ── */
export async function GET(request: NextRequest, ctx: RouteCtx) {
  try {
    const { athleteId, testTypeKey } = await ctx.params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canAccessAthlete(session.userId, session.role, athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = parseQuery(request, PerformanceTestTrendQuerySchema);
    if (parsed instanceof NextResponse) return parsed;
    const { limit } = parsed;

    const testType = await prisma.performanceTestType.findUnique({
      where: { key: testTypeKey },
      select: { id: true, key: true, name: true, unit: true, lowerIsBetter: true, iconKey: true },
    });
    if (!testType) {
      return NextResponse.json({ success: false, error: "Test type not found" }, { status: 404 });
    }

    // Take latest N descending, then reverse so the chart consumer gets
    // ascending order without a second sort hop.
    const latest = await prisma.performanceTestSession.findMany({
      where: { athleteId, testTypeId: testType.id },
      orderBy: { performedAt: "desc" },
      take: limit,
      select: {
        id: true,
        performedAt: true,
        peakValue: true,
        avgValue: true,
        attemptCount: true,
        recordedByRole: true,
      },
    });

    const points = latest
      .slice()
      .reverse()
      .map((s) => ({
        sessionId: s.id,
        performedAt: s.performedAt,
        peak: s.peakValue,
        avg: s.avgValue,
        attemptCount: s.attemptCount,
        recordedByRole: s.recordedByRole,
      }));

    return NextResponse.json({
      success: true,
      data: { testType, points },
    });
  } catch (error) {
    logger.error("GET performance-tests trends", { context: "performance-tests", error });
    return NextResponse.json({ success: false, error: "Couldn’t load trend" }, { status: 500 });
  }
}
