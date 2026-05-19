import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { loadAthleteDashboard } from "@/lib/athlete/dashboard-data";

export const dynamic = "force-dynamic";

/**
 * Athlete Home / Dashboard payload. Used for pull-to-refresh and any
 * client-driven re-fetch. Returns the same DTO the SSR page receives.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, firstName: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const dto = await loadAthleteDashboard(athlete.id, athlete.firstName);
    return NextResponse.json({ success: true, data: dto });
  } catch (err) {
    logger.error("GET /api/athlete/dashboard", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t load dashboard." },
      { status: 500 }
    );
  }
}
