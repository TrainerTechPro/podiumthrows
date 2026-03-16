import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/* ── GET — coach views self-logged sessions for their athletes ── */
export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: "Coach profile not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");
    const event = searchParams.get("event");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Build query — only show sessions from athletes on this coach's roster
    const where: Record<string, unknown> = {
      athlete: { coachId: coach.id },
    };
    if (athleteId) where.athleteId = athleteId;
    if (event) where.event = event;

    const sessions = await prisma.athleteThrowsSession.findMany({
      where,
      orderBy: { date: "desc" },
      take: limit,
      include: {
        drillLogs: { orderBy: { createdAt: "asc" } },
        athlete: { select: { firstName: true, lastName: true, id: true } },
      },
    });

    return NextResponse.json({ ok: true, data: sessions });
  } catch (err) {
    logger.error("GET /api/coach/athlete-sessions", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}
