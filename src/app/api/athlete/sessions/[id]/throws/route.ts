import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { recordThrow } from "@/lib/throws/pr";
import { awardPRAchievement } from "@/lib/achievements";
import { notifyCoachPR } from "@/lib/notifications";
import { parseBody, ThrowLogInputSchema } from "@/lib/api-schemas";
import { loadAthleteSessionDetail } from "@/lib/athlete/load-session-detail";
import type { EventType } from "@prisma/client";

/* ─── POST — log a single throw against this session ──────────────────────── */

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

    const trainingSession = await prisma.trainingSession.findFirst({
      where: { id, athleteId: athlete.id },
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

    const parsed = await parseBody(req, ThrowLogInputSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { event, implementKg, distance, rpe, notes, voiceNoteUrl, attemptNumber } = parsed;

    // Bondarchuk gate. The DTO surfaces blocks with implements sorted descending
    // and a per-implement done count. Reject any throw whose implementKg has a
    // heavier sibling in the same block that hasn't completed all prescribed
    // throws yet — that's an ascending sequence and Volume IV says no.
    const dto = await loadAthleteSessionDetail(id, athlete.id);
    if (dto) {
      const block = dto.blocks.find((b) => b.implements.some((c) => c.weightKg === implementKg));
      if (block) {
        const heavierUndone = block.implements.find((c) => c.weightKg > implementKg && !c.done);
        if (heavierUndone) {
          return NextResponse.json(
            {
              success: false,
              error: `Finish ${heavierUndone.weightKg}kg before logging ${implementKg}kg — descending order required.`,
            },
            { status: 409 }
          );
        }
      }
    }

    if (trainingSession.status === "SCHEDULED") {
      await prisma.trainingSession.update({
        where: { id },
        data: { status: "IN_PROGRESS" },
      });
    }

    const created = await prisma.throwLog.create({
      data: {
        athleteId: athlete.id,
        sessionId: id,
        event: event as EventType,
        implementWeight: implementKg,
        distance: distance ?? null,
        rpe: rpe ?? null,
        notes: notes?.trim() || null,
        videoUrl: voiceNoteUrl ?? null,
        attemptNumber: attemptNumber ?? null,
      },
      select: {
        id: true,
        event: true,
        implementWeight: true,
        distance: true,
        rpe: true,
        isPersonalBest: true,
        date: true,
        attemptNumber: true,
      },
    });

    let isPersonalBest = false;
    let previousBest: number | null = null;
    let previousBestDate: string | null = null;

    if (typeof distance === "number" && distance > 0) {
      const result = await recordThrow({
        athleteId: athlete.id,
        event,
        implementWeightKg: implementKg,
        distance,
      });
      isPersonalBest = result.isPersonalBest;
      previousBest = result.previousDistance;
      previousBestDate = result.previousAchievedAt;

      if (isPersonalBest) {
        await prisma.throwLog.update({
          where: { id: created.id },
          data: { isPersonalBest: true },
        });
        const athleteName = `${athlete.firstName} ${athlete.lastName}`;
        void awardPRAchievement(athlete.id, event).catch((err) =>
          logger.error("awardPRAchievement failed", { context: "api", error: err })
        );
        if (athlete.coachId) {
          void notifyCoachPR(athlete.coachId, athlete.id, athleteName, event, distance).catch(
            (err) => logger.error("notifyCoachPR failed", { context: "api", error: err })
          );
        }
      }
    }

    revalidateTag(`athlete-${athlete.id}`);
    if (athlete.coachId) revalidateTag(`coach-${athlete.coachId}`);

    return NextResponse.json(
      {
        success: true,
        data: {
          throw: {
            id: created.id,
            event: created.event as string,
            implementKg: created.implementWeight,
            distance: created.distance,
            rpe: created.rpe,
            isPersonalBest,
            loggedAt: created.date.toISOString(),
            attemptNumber: created.attemptNumber,
          },
          previousBest,
          previousBestDate,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("POST /api/athlete/sessions/[id]/throws", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to log throw." }, { status: 500 });
  }
}
