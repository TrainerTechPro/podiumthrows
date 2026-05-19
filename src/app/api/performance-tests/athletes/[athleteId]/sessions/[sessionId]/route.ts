import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

type RouteCtx = { params: Promise<{ athleteId: string; sessionId: string }> };

/* ── GET — fetch a single session with all attempts and attribution ── */
export async function GET(_request: NextRequest, ctx: RouteCtx) {
  try {
    const { athleteId, sessionId } = await ctx.params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canAccessAthlete(session.userId, session.role, athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const result = await prisma.performanceTestSession.findFirst({
      where: { id: sessionId, athleteId },
      include: {
        testType: true,
        attempts: { orderBy: { attemptNumber: "asc" } },
        recordedBy: {
          select: {
            id: true,
            coachProfile: { select: { firstName: true, lastName: true } },
            athleteProfile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!result) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error("GET performance-tests session", { context: "performance-tests", error });
    return NextResponse.json({ success: false, error: "Couldn’t load session" }, { status: 500 });
  }
}
