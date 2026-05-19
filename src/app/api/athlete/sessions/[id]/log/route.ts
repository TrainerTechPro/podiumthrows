import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { isValidEvent } from "@/lib/throws";
import { recordThrow } from "@/lib/throws/pr";
import { awardPRAchievement } from "@/lib/achievements";
import { notifyCoachPR } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { parseBody, SessionLogSchema } from "@/lib/api-schemas";

/* ─── POST — log an exercise set for a session ────────────────────────────── */

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, coachId: true, firstName: true, lastName: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    // Verify session belongs to this athlete and is active
    const trainingSession = await prisma.trainingSession.findFirst({
      where: { id: id, athleteId: athlete.id },
      select: { id: true, status: true },
    });

    if (!trainingSession) {
      return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 });
    }

    if (trainingSession.status === "COMPLETED") {
      return NextResponse.json(
        { success: false, error: "Cannot log to a completed session." },
        { status: 409 }
      );
    }

    // Auto-transition SCHEDULED → IN_PROGRESS on first log
    if (trainingSession.status === "SCHEDULED") {
      await prisma.trainingSession.update({
        where: { id: id },
        data: { status: "IN_PROGRESS" },
      });
    }

    const parsed = await parseBody(req, SessionLogSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { exerciseName, sets, reps, weight, rpe, distance, notes, isThrow, event, implementKg } =
      parsed;

    // Create the session log
    const log = await prisma.sessionLog.create({
      data: {
        sessionId: id,
        athleteId: athlete.id,
        exerciseName: exerciseName.trim(),
        sets,
        reps: reps ?? null,
        weight: weight ?? null,
        rpe: rpe ?? null,
        distance: distance ?? null,
        notes: notes?.trim() || null,
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
    let prevBestForResponse: number | null = null;
    let prevBestDateForResponse: string | null = null;
    if (
      isThrow === true &&
      event != null &&
      isValidEvent(event) &&
      typeof implementKg === "number" &&
      typeof distance === "number" &&
      distance > 0
    ) {
      throwLog = await prisma.throwLog.create({
        data: {
          athleteId: athlete.id,
          sessionId: id,
          event: event as never,
          implementWeight: implementKg,
          distance,
          isPersonalBest: false,
          notes: notes?.trim() || null,
        },
        select: {
          id: true,
          event: true,
          implementWeight: true,
          distance: true,
          isPersonalBest: true,
        },
      });

      const prResult = await recordThrow({
        athleteId: athlete.id,
        event,
        implementWeightKg: implementKg,
        distance,
      });
      const isPersonalBest = prResult.isPersonalBest;
      prevBestForResponse = prResult.previousDistance;
      prevBestDateForResponse = prResult.previousAchievedAt;

      if (isPersonalBest) {
        await prisma.throwLog.update({
          where: { id: throwLog.id },
          data: { isPersonalBest: true },
        });
        throwLog.isPersonalBest = true;
      }

      // Fire-and-forget: award achievement + notify coach on new PR
      if (isPersonalBest) {
        const athleteName = `${athlete.firstName} ${athlete.lastName}`;
        void awardPRAchievement(athlete.id, event).catch((err) =>
          logger.error("Async operation failed", { context: "api", error: err })
        );
        if (athlete.coachId) {
          void notifyCoachPR(athlete.coachId, athlete.id, athleteName, event, distance).catch(
            (err) => logger.error("Async operation failed", { context: "api", error: err })
          );
        }
      }
    }

    // Invalidate cached data so other widgets update without a page refresh
    revalidateTag(`athlete-${athlete.id}`);
    if (athlete.coachId) revalidateTag(`coach-${athlete.coachId}`);

    return NextResponse.json(
      {
        success: true,
        data: {
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
          previousBest: prevBestForResponse,
          previousBestDate: prevBestDateForResponse,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("POST /api/athlete/sessions/[id]/log", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Couldn’t log exercise." }, { status: 500 });
  }
}
