import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, SessionCompleteSchema } from "@/lib/api-schemas";
import { updateThrowsStreak } from "@/lib/streak";
import { emitSessionComplete } from "@/lib/team-activity";

/* ─── PATCH — mark session as completed ──────────────────────────────────── */

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, coachId: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    // Verify session belongs to this athlete
    const trainingSession = await prisma.trainingSession.findFirst({
      where: { id: id, athleteId: athlete.id },
      select: { id: true, status: true },
    });

    if (!trainingSession) {
      return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 });
    }

    if (trainingSession.status === "COMPLETED") {
      return NextResponse.json(
        { success: false, error: "Session already completed." },
        { status: 409 }
      );
    }

    const parsed = await parseBody(req, SessionCompleteSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { rpe, notes } = parsed;

    const updated = await prisma.trainingSession.update({
      where: { id: id },
      data: {
        status: "COMPLETED",
        completedDate: new Date(),
        rpe: rpe ?? null,
        notes: notes?.trim() || null,
      },
      select: {
        id: true,
        status: true,
        completedDate: true,
        rpe: true,
        logs: { select: { sets: true, reps: true, weight: true } },
        throwLogs: {
          select: { distance: true, isPersonalBest: true, event: true, implementWeight: true },
        },
        plan: {
          select: {
            blocks: {
              select: {
                exercises: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    // Update streak — throws-based helper recomputes from ThrowLog history
    await updateThrowsStreak(athlete.id);

    // Compute summary stats
    const totalExercises = updated.logs.length;
    const prescribedCount =
      updated.plan?.blocks.reduce((sum, b) => sum + b.exercises.length, 0) ?? 0;
    const totalVolume = updated.logs.reduce((sum, l) => {
      if (l.weight != null && l.reps != null && l.sets > 0) {
        return sum + l.sets * l.reps * l.weight;
      }
      return sum;
    }, 0);
    const throwCount = updated.throwLogs.length;
    const throwsWithDistance = updated.throwLogs.filter((t) => t.distance != null);
    const bestThrow =
      throwsWithDistance.length > 0
        ? throwsWithDistance.reduce((best, t) =>
            (t.distance ?? 0) > (best.distance ?? 0) ? t : best
          )
        : null;
    const prCount = updated.throwLogs.filter((t) => t.isPersonalBest).length;

    // Fire team feed SESSION event. Fire-and-forget — a failed emit
    // cannot break the session-complete response. PR feed events for
    // throws logged inside this session were emitted at their
    // creation site (quick-log POST), not here, to avoid duplicates.
    void emitSessionComplete(athlete.id, {
      throwCount,
      bestDistance: bestThrow?.distance ?? null,
      sessionId: updated.id,
    }).catch(() => null);

    // Invalidate cached data so other widgets update without a page refresh
    revalidateTag(`athlete-${athlete.id}`);
    if (athlete.coachId) revalidateTag(`coach-${athlete.coachId}`);

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        completedDate: updated.completedDate?.toISOString() ?? null,
        rpe: updated.rpe,
        summary: {
          totalExercises,
          prescribedCount,
          completionPercent:
            prescribedCount > 0 ? Math.round((totalExercises / prescribedCount) * 100) : 100,
          totalVolume: Math.round(totalVolume),
          throwCount,
          bestThrow: bestThrow
            ? {
                distance: bestThrow.distance,
                event: bestThrow.event,
                implementWeight: bestThrow.implementWeight,
              }
            : null,
          prCount,
        },
      },
    });
  } catch (err) {
    logger.error("PATCH /api/athlete/sessions/[id]/complete", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to complete session." },
      { status: 500 }
    );
  }
}
