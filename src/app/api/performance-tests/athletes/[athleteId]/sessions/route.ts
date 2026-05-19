import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, parseQuery } from "@/lib/api-schemas";
import {
  PerformanceTestSessionCreateSchema,
  PerformanceTestSessionListQuerySchema,
} from "@/lib/performance-tests-schemas";

type RouteCtx = { params: Promise<{ athleteId: string }> };

/* ── GET — list sessions for an athlete (cursor-paginated) ── */
export async function GET(request: NextRequest, ctx: RouteCtx) {
  try {
    const { athleteId } = await ctx.params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canAccessAthlete(session.userId, session.role, athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = parseQuery(request, PerformanceTestSessionListQuerySchema);
    if (parsed instanceof NextResponse) return parsed;
    const { testTypeKey, limit, cursor } = parsed;

    const where: Record<string, unknown> = { athleteId };
    if (testTypeKey) {
      const testType = await prisma.performanceTestType.findUnique({
        where: { key: testTypeKey },
        select: { id: true },
      });
      if (!testType) {
        return NextResponse.json({ success: true, data: { items: [], nextCursor: null } });
      }
      where.testTypeId = testType.id;
    }

    const items = await prisma.performanceTestSession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        testType: {
          select: { key: true, name: true, unit: true, lowerIsBetter: true, iconKey: true },
        },
        recordedBy: {
          select: {
            coachProfile: { select: { firstName: true, lastName: true } },
            athleteProfile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return NextResponse.json({ success: true, data: { items: page, nextCursor } });
  } catch (error) {
    logger.error("GET /api/performance-tests/athletes/[athleteId]/sessions", {
      context: "performance-tests",
      error,
    });
    return NextResponse.json({ success: false, error: "Couldn’t load sessions" }, { status: 500 });
  }
}

/* ── POST — create a session (no attempts yet) ── */
export async function POST(request: NextRequest, ctx: RouteCtx) {
  try {
    const { athleteId } = await ctx.params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canAccessAthlete(session.userId, session.role, athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(request, PerformanceTestSessionCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { testTypeId, performedAt, notes, conditions } = parsed;

    const testType = await prisma.performanceTestType.findUnique({
      where: { id: testTypeId },
      select: { id: true, archived: true },
    });
    if (!testType || testType.archived) {
      return NextResponse.json({ success: false, error: "Test type not found" }, { status: 404 });
    }

    const created = await prisma.performanceTestSession.create({
      data: {
        athleteId,
        testTypeId,
        performedAt: performedAt ? new Date(performedAt) : new Date(),
        recordedById: session.userId,
        recordedByRole: session.role,
        notes: notes ?? null,
        conditions: conditions ?? null,
        peakValue: null,
        avgValue: null,
        attemptCount: 0,
      },
      include: {
        testType: {
          select: { key: true, name: true, unit: true, lowerIsBetter: true, iconKey: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    logger.error("POST /api/performance-tests/athletes/[athleteId]/sessions", {
      context: "performance-tests",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Couldn’t create session" },
      { status: 500 }
    );
  }
}
