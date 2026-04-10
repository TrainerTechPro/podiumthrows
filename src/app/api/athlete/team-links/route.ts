import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getTeamLinks } from "@/lib/data/team-hub";

/* ─── GET — list team links visible to the authenticated athlete ─────────── */

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { coachId: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found." }, { status: 404 });
    }

    // Athletes see their coach's links (read-only)
    const data = await getTeamLinks(athlete.coachId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    logger.error("GET /api/athlete/team-links", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to fetch team links." }, { status: 500 });
  }
}
