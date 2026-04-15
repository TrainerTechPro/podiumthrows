import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * GET /api/coach/assessments/latest
 *
 * Returns a map of the coach's roster — athleteId → latest Bondarchuk assessment
 * completedAt (ISO string), or null if the athlete has never been assessed.
 *
 * Used by session-assign UIs to render the AssessmentStatusBadge per row and
 * to pre-flag stale athletes before the coach hits Save.
 *
 * Response: { success: true, data: Record<athleteId, string | null> }
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Coach access required" }, { status: 403 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 404 }
      );
    }

    const athletes = await prisma.athleteProfile.findMany({
      where: { coachId: coach.id },
      select: { id: true },
    });

    const assessments = await prisma.bondarchukAssessment.findMany({
      where: { athleteId: { in: athletes.map((a) => a.id) } },
      select: { athleteId: true, completedAt: true },
      orderBy: { completedAt: "desc" },
    });

    const latestByAthlete: Record<string, string | null> = {};
    for (const a of athletes) latestByAthlete[a.id] = null;
    for (const row of assessments) {
      if (latestByAthlete[row.athleteId] === null) {
        latestByAthlete[row.athleteId] = row.completedAt.toISOString();
      }
    }

    return NextResponse.json({ success: true, data: latestByAthlete });
  } catch (error) {
    logger.error("GET /api/coach/assessments/latest error", { context: "assessments", error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
