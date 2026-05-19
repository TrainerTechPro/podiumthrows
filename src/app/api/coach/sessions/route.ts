import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { withIdempotency } from "@/lib/idempotency";
import { parseBodyText, CoachAssignSessionsSchema } from "@/lib/api-schemas";

/* ─── POST — assign plan to athletes as training sessions ────────────────── */

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "COACH") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return withIdempotency(
    { userId: session.userId, endpoint: "/api/coach/sessions", req },
    async (bodyText) => postHandler(session.userId, bodyText)
  );
}

async function postHandler(userId: string, bodyText: string): Promise<NextResponse> {
  try {
    const coach = await prisma.coachProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const parsed = parseBodyText(bodyText, CoachAssignSessionsSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { planId, athleteIds, scheduledDate, coachNotes } = parsed;

    // Verify plan belongs to this coach
    const plan = await prisma.workoutPlan.findFirst({
      where: { id: planId, coachId: coach.id },
      select: { id: true },
    });
    if (!plan) {
      return NextResponse.json({ success: false, error: "Plan not found." }, { status: 404 });
    }

    // Verify all athletes belong to this coach
    const validAthletes = await prisma.athleteProfile.findMany({
      where: { id: { in: athleteIds }, coachId: coach.id },
      select: { id: true },
    });
    const validIds = new Set(validAthletes.map((a) => a.id));
    const invalidIds = athleteIds.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { success: false, error: "Some athletes are not on your roster." },
        { status: 400 }
      );
    }

    // Create training sessions for each athlete
    const parsedDate = new Date(scheduledDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid date." }, { status: 400 });
    }

    const sessions = await prisma.trainingSession.createMany({
      data: athleteIds.map((athleteId) => ({
        planId,
        athleteId,
        scheduledDate: parsedDate,
        coachNotes: coachNotes ? coachNotes.trim() || null : null,
        status: "SCHEDULED" as const,
      })),
    });

    return NextResponse.json(
      {
        success: true,
        data: { created: sessions.count, scheduledDate: parsedDate.toISOString() },
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("POST /api/coach/sessions", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t assign sessions." },
      { status: 500 }
    );
  }
}
