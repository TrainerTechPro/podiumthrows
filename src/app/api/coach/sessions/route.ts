import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/* ─── POST — assign plan to athletes as training sessions ────────────────── */

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const { planId, athleteIds, scheduledDate, coachNotes } = body as Record<string, unknown>;

    // Validate
    if (typeof planId !== "string") {
      return NextResponse.json({ error: "Plan ID is required." }, { status: 400 });
    }
    if (!Array.isArray(athleteIds) || athleteIds.length === 0) {
      return NextResponse.json({ error: "Select at least one athlete." }, { status: 400 });
    }
    if (typeof scheduledDate !== "string") {
      return NextResponse.json({ error: "Scheduled date is required." }, { status: 400 });
    }

    // Verify plan belongs to this coach
    const plan = await prisma.workoutPlan.findFirst({
      where: { id: planId, coachId: coach.id },
      select: { id: true },
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }

    // Verify all athletes belong to this coach
    const validAthletes = await prisma.athleteProfile.findMany({
      where: { id: { in: athleteIds as string[] }, coachId: coach.id },
      select: { id: true },
    });
    const validIds = new Set(validAthletes.map((a) => a.id));
    const invalidIds = (athleteIds as string[]).filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: "Some athletes are not on your roster." }, { status: 400 });
    }

    // Create training sessions for each athlete
    const parsedDate = new Date(scheduledDate as string);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid date." }, { status: 400 });
    }

    const sessions = await prisma.trainingSession.createMany({
      data: (athleteIds as string[]).map((athleteId) => ({
        planId: planId as string,
        athleteId,
        scheduledDate: parsedDate,
        coachNotes: typeof coachNotes === "string" ? coachNotes.trim() || null : null,
        status: "SCHEDULED" as const,
      })),
    });

    return NextResponse.json(
      { created: sessions.count, scheduledDate: parsedDate.toISOString() },
      { status: 201 }
    );
  } catch (err) {
    logger.error("POST /api/coach/sessions", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to assign sessions." }, { status: 500 });
  }
}
