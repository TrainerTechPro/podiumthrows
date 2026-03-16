import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isValidEvent, checkAndSetPR } from "@/lib/throws";
import { awardPRAchievement } from "@/lib/achievements";
import { notifyCoachPR } from "@/lib/notifications";
import { logger } from "@/lib/logger";

/* ─── POST — log an exercise set for a session ────────────────────────────── */

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, coachId: true, firstName: true, lastName: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // Verify session belongs to this athlete and is active
    const trainingSession = await prisma.trainingSession.findFirst({
      where: { id: params.id, athleteId: athlete.id },
      select: { id: true, status: true },
    });

    if (!trainingSession) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    if (trainingSession.status === "COMPLETED") {
      return NextResponse.json({ error: "Cannot log to a completed session." }, { status: 409 });
    }

    // Auto-transition SCHEDULED → IN_PROGRESS on first log
    if (trainingSession.status === "SCHEDULED") {
      await prisma.trainingSession.update({
        where: { id: params.id },
        data: { status: "IN_PROGRESS" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const {
      exerciseName,
      sets,
      reps,
      weight,
      rpe,
      distance,
      notes,
      // Throw-specific fields
      isThrow,
      event,
      implementKg,
    } = body as Record<string, unknown>;

    // Validate common fields
    if (typeof exerciseName !== "string" || exerciseName.trim().length === 0) {
      return NextResponse.json({ error: "Exercise name is required." }, { status: 400 });
    }
    if (typeof sets !== "number" || sets < 1) {
      return NextResponse.json({ error: "Sets must be at least 1." }, { status: 400 });
    }

    // Create the session log
    const log = await prisma.sessionLog.create({
      data: {
        sessionId: params.id,
        athleteId: athlete.id,
        exerciseName: (exerciseName as string).trim(),
        sets: sets as number,
        reps: typeof reps === "number" ? reps : null,
        weight: typeof weight === "number" ? weight : null,
        rpe: typeof rpe === "number" && rpe >= 1 && rpe <= 10 ? rpe : null,
        distance: typeof distance === "number" ? distance : null,
        notes: typeof notes === "string" ? notes.trim() || null : null,
      },
      select: {
        id: true,
        exerciseName: true,
        sets: true,
        reps: true,
        weight: true,
        rpe: true,
        distance: true,
        completedAt: true,
      },
    });

    // If this is a throw, also create a ThrowLog and check PR
    let throwLog = null;
    if (
      isThrow === true &&
      isValidEvent(event) &&
      typeof implementKg === "number" &&
      typeof distance === "number" &&
      distance > 0
    ) {
      const { isPersonalBest } = await checkAndSetPR(
        athlete.id,
        event,
        implementKg,
        distance as number
      );

      throwLog = await prisma.throwLog.create({
        data: {
          athleteId: athlete.id,
          sessionId: params.id,
          event: event as never,
          implementWeight: implementKg,
          distance: distance as number,
          isPersonalBest,
          notes: typeof notes === "string" ? notes.trim() || null : null,
        },
        select: {
          id: true,
          event: true,
          implementWeight: true,
          distance: true,
          isPersonalBest: true,
        },
      });

      // Fire-and-forget: award achievement + notify coach on new PR
      if (isPersonalBest) {
        const athleteName = `${athlete.firstName} ${athlete.lastName}`;
        void awardPRAchievement(athlete.id, event).catch((err) => logger.error("Async operation failed", { context: "api", error: err }));
        if (athlete.coachId) {
          void notifyCoachPR(
            athlete.coachId,
            athlete.id,
            athleteName,
            event,
            distance as number
          ).catch((err) => logger.error("Async operation failed", { context: "api", error: err }));
        }
      }
    }

    return NextResponse.json(
      {
        log: {
          ...log,
          completedAt: log.completedAt.toISOString(),
        },
        throwLog: throwLog
          ? {
              ...throwLog,
              event: throwLog.event as string,
            }
          : null,
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("POST /api/athlete/sessions/[id]/log", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to log exercise." }, { status: 500 });
  }
}
