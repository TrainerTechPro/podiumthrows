import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { recordThrow } from "@/lib/throws/pr";
import { awardPRAchievement } from "@/lib/achievements";
import { notifyCoachPR } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { parseBody, AthleteThrowLogSchema } from "@/lib/api-schemas";

/* ─── POST — log a standalone throw (outside of a session) ────────────────── */

export async function POST(req: NextRequest) {
  try {
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

    const parsed = await parseBody(req, AthleteThrowLogSchema);
    if (parsed instanceof NextResponse) return parsed;
    const {
      event,
      implementKg,
      distance,
      isCompetition,
      rpe,
      notes,
      attemptNumber,
      wireLength,
      implementWeightUnit,
      implementWeightOriginal,
    } = parsed;

    // Create throw log first (no session — standalone), then atomic PR write.
    const throwLog = await prisma.throwLog.create({
      data: {
        athleteId: athlete.id,
        sessionId: null,
        event: event as never,
        implementWeight: implementKg,
        implementWeightUnit: implementWeightUnit ?? "kg",
        implementWeightOriginal: implementWeightOriginal ?? null,
        distance,
        isPersonalBest: false,
        isCompetition: isCompetition === true,
        rpe: rpe ?? null,
        attemptNumber: attemptNumber ?? null,
        wireLength: wireLength ?? null,
        notes: notes ? notes.trim() || null : null,
      },
      select: {
        id: true,
        event: true,
        implementWeight: true,
        distance: true,
        isPersonalBest: true,
        isCompetition: true,
        rpe: true,
        attemptNumber: true,
        date: true,
      },
    });

    const { isPersonalBest } = await recordThrow({
      athleteId: athlete.id,
      event,
      implementWeightKg: implementKg,
      distance,
      source: isCompetition === true ? "COMPETITION" : "TRAINING",
    });

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
        void notifyCoachPR(athlete.coachId, athlete.id, athleteName, event, distance).catch((err) =>
          logger.error("Async operation failed", { context: "api", error: err })
        );
      }
    }

    // Invalidate caches for this athlete and their coach
    revalidateTag(`athlete-${athlete.id}`);
    if (athlete.coachId) revalidateTag(`coach-${athlete.coachId}`);

    return NextResponse.json(
      {
        success: true,
        data: {
          throwLog: {
            ...throwLog,
            event: throwLog.event as string,
            date: throwLog.date.toISOString(),
          },
          isPersonalBest,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("POST /api/athlete/throws", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Couldn’t log throw." }, { status: 500 });
  }
}
