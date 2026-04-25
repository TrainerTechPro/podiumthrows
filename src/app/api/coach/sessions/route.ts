import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { withIdempotency } from "@/lib/idempotency";

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

    let body: Record<string, unknown>;
    try {
      body = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }
    const { planId, athleteIds, scheduledDate, coachNotes } = body;

    // Validate
    if (typeof planId !== "string") {
      return NextResponse.json({ success: false, error: "Plan ID is required." }, { status: 400 });
    }
    if (!Array.isArray(athleteIds) || athleteIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Select at least one athlete." },
        { status: 400 }
      );
    }
    if (typeof scheduledDate !== "string") {
      return NextResponse.json(
        { success: false, error: "Scheduled date is required." },
        { status: 400 }
      );
    }

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
      where: { id: { in: athleteIds as string[] }, coachId: coach.id },
      select: { id: true },
    });
    const validIds = new Set(validAthletes.map((a) => a.id));
    const invalidIds = (athleteIds as string[]).filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { success: false, error: "Some athletes are not on your roster." },
        { status: 400 }
      );
    }

    // Create training sessions for each athlete
    const parsedDate = new Date(scheduledDate as string);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid date." }, { status: 400 });
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

    // eslint-disable-next-line no-restricted-syntax -- TODO(HIGH-03-follow-up): migrate to { success: true, data } envelope
    return NextResponse.json(
      { created: sessions.count, scheduledDate: parsedDate.toISOString() },
      { status: 201 }
    );
  } catch (err) {
    logger.error("POST /api/coach/sessions", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to assign sessions." },
      { status: 500 }
    );
  }
}
