import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { canAccessAthlete } from "@/lib/authorize";
import { getAthleteAvailability } from "@/lib/data/availability";

/* ─── GET — single athlete's availability (coach view) ───────────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
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
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const { athleteId } = await params;

    const hasAccess = await canAccessAthlete(session.userId, "COACH", athleteId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Athlete not found or access denied" }, { status: 404 });
    }

    const data = await getAthleteAvailability(athleteId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    logger.error("GET /api/coach/availability/[athleteId]", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to fetch athlete availability." }, { status: 500 });
  }
}
