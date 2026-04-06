import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getAthleteAnnouncements } from "@/lib/data/team-hub";

/* ─── GET — list announcements visible to the authenticated athlete ──────── */

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found." }, { status: 404 });
    }

    const data = await getAthleteAnnouncements(athlete.id);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    logger.error("GET /api/athlete/announcements", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to fetch announcements." }, { status: 500 });
  }
}
