import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, PracticeAttemptCreateSchema } from "@/lib/api-schemas";
import { parseImplementKg } from "@/lib/throws";
import { recordThrow } from "@/lib/throws/pr";
import { EventType } from "@prisma/client";

// POST /api/throws/practice/[sessionId]/attempts — log a new attempt
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Coach access required" }, { status: 403 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
    }

    const session = await prisma.practiceSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    if (session.status === "CLOSED") {
      return NextResponse.json({ success: false, error: "Session is closed" }, { status: 400 });
    }

    const parsed = await parseBody(request, PracticeAttemptCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { athleteId, event, implement, distance, drillType, coachNote, videoUrl, attemptNumber } = parsed;

    // Verify coach owns this athlete
    const authorized = await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId);
    if (!authorized) {
      return NextResponse.json({ success: false, error: "Not authorized to log attempts for this athlete" }, { status: 403 });
    }

    // Auto-detect PR: atomic write via canonical recordThrow helper.
    let isPR = false;
    if (distance !== undefined && distance !== null) {
      const implementKg = parseImplementKg(implement);
      if (implementKg != null && implementKg > 0) {
        const prResult = await recordThrow({
          athleteId,
          event,
          implementWeightKg: implementKg,
          implementLabel: implement,
          distance,
        });
        isPR = prResult.isPersonalBest;
      }
    }

    const attempt = await prisma.practiceAttempt.create({
      data: {
        sessionId: sessionId,
        athleteId,
        event: event as EventType,
        implement,
        distance: distance ?? null,
        drillType: drillType || null,
        coachNote: coachNote || null,
        videoUrl: videoUrl || null,
        isPR,
        attemptNumber: attemptNumber ?? 1,
      },
      include: {
        athlete: {
          select: {
            id: true,
            avatarUrl: true,
            user: { select: { id: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: attempt });
  } catch (error) {
    logger.error("POST /api/throws/practice/[sessionId]/attempts error", { context: "throws/practice/attempts", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
