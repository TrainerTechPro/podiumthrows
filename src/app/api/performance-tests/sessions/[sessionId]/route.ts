import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

type RouteCtx = { params: Promise<{ sessionId: string }> };

/* ── DELETE — remove a session and all its attempts (cascade) ── */
export async function DELETE(_request: NextRequest, ctx: RouteCtx) {
  try {
    const { sessionId } = await ctx.params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const target = await prisma.performanceTestSession.findUnique({
      where: { id: sessionId },
      select: { athleteId: true },
    });
    if (!target) {
      // Idempotent — empty-session cleanup may issue a delete after a sibling
      // tab already cleared the row.
      return NextResponse.json({ success: true, data: { id: sessionId } });
    }
    if (!(await canAccessAthlete(session.userId, session.role, target.athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    await prisma.performanceTestSession.delete({ where: { id: sessionId } });
    return NextResponse.json({ success: true, data: { id: sessionId } });
  } catch (error) {
    logger.error("DELETE performance-tests session", { context: "performance-tests", error });
    return NextResponse.json(
      { success: false, error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
