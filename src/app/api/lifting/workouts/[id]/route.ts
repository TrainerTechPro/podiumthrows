import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, LiftingWorkoutPatchSchema } from "@/lib/api-schemas";

/* ─── PATCH — save / complete a workout log ────────────────────────────────── */

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const { id } = await params;

    // ── Verify workout exists and belongs to this coach ───────────────────
    const existing = await prisma.liftingWorkoutLog.findFirst({
      where: { id, coachId: coach.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Workout log not found." },
        { status: 404 }
      );
    }

    const parsed = await parseBody(request, LiftingWorkoutPatchSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { status, actualRpe, notes, durationMinutes, exerciseLogs } = parsed;

    // ── Build workout update data ─────────────────────────────────────────
    const workoutUpdate: Record<string, unknown> = {};

    if (status != null) {
      workoutUpdate.status = status;
      if (status === "COMPLETED") {
        workoutUpdate.completedAt = new Date();
      }
    }
    if (actualRpe !== undefined) {
      workoutUpdate.actualRpe = typeof actualRpe === "number" ? actualRpe : null;
    }
    if (notes !== undefined) {
      workoutUpdate.notes =
        typeof notes === "string" && notes.trim().length > 0 ? notes.trim() : null;
    }
    if (durationMinutes !== undefined) {
      workoutUpdate.durationMinutes = typeof durationMinutes === "number" ? durationMinutes : null;
    }

    // ── Transaction: update workout + upsert exercise logs ────────────────
    await prisma.$transaction(async (tx) => {
      if (Object.keys(workoutUpdate).length > 0) {
        await tx.liftingWorkoutLog.update({
          where: { id },
          data: workoutUpdate as never,
        });
      }

      if (Array.isArray(exerciseLogs)) {
        for (const log of exerciseLogs) {
          const logData = {
            exerciseName: typeof log.exerciseName === "string" ? log.exerciseName.trim() : "",
            order: typeof log.order === "number" ? log.order : 0,
            sets: typeof log.sets === "number" ? log.sets : null,
            reps: typeof log.reps === "number" ? log.reps : null,
            load: typeof log.load === "number" ? log.load : null,
            loadUnit: typeof log.loadUnit === "string" ? log.loadUnit : "lbs",
            duration: typeof log.duration === "number" ? log.duration : null,
            isSkipped: log.isSkipped === true,
            isAdded: log.isAdded === true,
            isModified: log.isModified === true,
            notes:
              typeof log.notes === "string" && log.notes.trim().length > 0
                ? log.notes.trim()
                : null,
          };

          if (typeof log.id === "string" && log.id.length > 0) {
            await tx.liftingExerciseLog.update({
              where: { id: log.id },
              data: logData,
            });
          } else {
            await tx.liftingExerciseLog.create({
              data: {
                ...logData,
                workoutLogId: id,
                programExerciseId:
                  typeof log.programExerciseId === "string" && log.programExerciseId.length > 0
                    ? log.programExerciseId
                    : null,
              },
            });
          }
        }
      }
    });

    const updated = await prisma.liftingWorkoutLog.findUnique({
      where: { id },
      include: {
        exerciseLogs: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    logger.error("PATCH /api/lifting/workouts/[id]", {
      context: "api",
      error: err,
    });
    return NextResponse.json({ success: false, error: "Couldn’t save workout." }, { status: 500 });
  }
}
