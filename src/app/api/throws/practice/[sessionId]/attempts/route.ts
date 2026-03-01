import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

// POST /api/throws/practice/[sessionId]/attempts — log a new attempt
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
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
      where: { id: params.sessionId },
    });
    if (!session || session.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    if (session.status === "CLOSED") {
      return NextResponse.json({ success: false, error: "Session is closed" }, { status: 400 });
    }

    const body = await request.json();
    const { athleteId, event, implement, distance, drillType, coachNote, videoUrl, attemptNumber } = body;

    if (!athleteId || !event || !implement) {
      return NextResponse.json(
        { success: false, error: "athleteId, event, and implement are required" },
        { status: 400 }
      );
    }

    // Verify coach owns this athlete
    const authorized = await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId);
    if (!authorized) {
      return NextResponse.json({ success: false, error: "Not authorized to log attempts for this athlete" }, { status: 403 });
    }

    // Auto-detect PR: compare against existing ThrowsPR
    let isPR = false;
    if (distance !== undefined && distance !== null) {
      const existingPR = await prisma.throwsPR.findUnique({
        where: { athleteId_event_implement: { athleteId, event, implement } },
      });

      if (!existingPR || distance > existingPR.distance) {
        isPR = true;
        // Upsert the PR record
        const today = new Date().toISOString().slice(0, 10);
        await prisma.throwsPR.upsert({
          where: { athleteId_event_implement: { athleteId, event, implement } },
          update: { distance, achievedAt: today, source: "TRAINING" },
          create: { athleteId, event, implement, distance, achievedAt: today, source: "TRAINING" },
        });
      }
    }

    const attempt = await prisma.practiceAttempt.create({
      data: {
        sessionId: params.sessionId,
        athleteId,
        event,
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
