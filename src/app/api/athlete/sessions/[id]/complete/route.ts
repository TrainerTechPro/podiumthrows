import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";

/* ─── PATCH — mark session as completed ──────────────────────────────────── */

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // Verify session belongs to this athlete
    const trainingSession = await prisma.trainingSession.findFirst({
      where: { id: params.id, athleteId: athlete.id },
      select: { id: true, status: true },
    });

    if (!trainingSession) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    if (trainingSession.status === "COMPLETED") {
      return NextResponse.json({ error: "Session already completed." }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const { rpe, notes } = body as Record<string, unknown>;

    const updated = await prisma.trainingSession.update({
      where: { id: params.id },
      data: {
        status: "COMPLETED",
        completedDate: new Date(),
        rpe: typeof rpe === "number" && rpe >= 1 && rpe <= 10 ? rpe : null,
        notes: typeof notes === "string" ? notes.trim() || null : null,
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

    // Update streak
    await updateAthleteStreak(athlete.id);

    // Compute summary stats
    const totalExercises = updated.logs.length;
    const prescribedCount = updated.plan?.blocks.reduce(
      (sum, b) => sum + b.exercises.length, 0
    ) ?? 0;
    const totalVolume = updated.logs.reduce((sum, l) => {
      if (l.weight != null && l.reps != null && l.sets > 0) {
        return sum + l.sets * l.reps * l.weight;
      }
      return sum;
    }, 0);
    const throwCount = updated.throwLogs.length;
    const bestThrow = updated.throwLogs.length > 0
      ? updated.throwLogs.reduce((best, t) => t.distance > best.distance ? t : best)
      : null;
    const prCount = updated.throwLogs.filter((t) => t.isPersonalBest).length;

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      completedDate: updated.completedDate?.toISOString() ?? null,
      rpe: updated.rpe,
      summary: {
        totalExercises,
        prescribedCount,
        completionPercent: prescribedCount > 0
          ? Math.round((totalExercises / prescribedCount) * 100)
          : 100,
        totalVolume: Math.round(totalVolume),
        throwCount,
        bestThrow: bestThrow
          ? { distance: bestThrow.distance, event: bestThrow.event, implementWeight: bestThrow.implementWeight }
          : null,
        prCount,
      },
    });
  } catch (err) {
    logger.error("PATCH /api/athlete/sessions/[id]/complete", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to complete session." }, { status: 500 });
  }
}

async function updateAthleteStreak(athleteId: string) {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterdaySession = await prisma.trainingSession.findFirst({
      where: {
        athleteId,
        status: "COMPLETED",
        completedDate: { gte: yesterday, lt: today },
      },
      select: { id: true },
    });

    const athlete = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { currentStreak: true, longestStreak: true },
    });
    if (!athlete) return;

    const newStreak = yesterdaySession ? athlete.currentStreak + 1 : 1;

    await prisma.athleteProfile.update({
      where: { id: athleteId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, athlete.longestStreak),
        lastActivityDate: new Date(),
      },
    });
  } catch {
    // Non-critical
  }
}
