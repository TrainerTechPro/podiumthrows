import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { loadAthleteSessionDetail } from "@/lib/athlete/load-session-detail";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const dto = await loadAthleteSessionDetail(id, athlete.id);
    if (!dto) {
      return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: dto });
  } catch (err) {
    logger.error("GET /api/athlete/sessions/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to load session." }, { status: 500 });
  }
}
