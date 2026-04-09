import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCoachApi } from "@/lib/data/coach";
import { logger } from "@/lib/logger";

/* ── GET — list video analyses for the coach ── */
export async function GET(request: NextRequest) {
  try {
    const { coach } = await requireCoachApi();

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");
    const event = searchParams.get("event");

    const where: Record<string, unknown> = { coachId: coach.id };
    if (athleteId) where.athleteId = athleteId;
    if (event) where.event = event;

    const analyses = await prisma.videoAnalysis.findMany({
      where,
      include: {
        athlete: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: analyses });
  } catch (err) {
    if (err instanceof Error && err.name === "AuthError") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/video-analysis", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to fetch analyses" }, { status: 500 });
  }
}
