import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/* ─── PATCH — save / complete a workout log ────────────────────────────────── */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const { id } = await params;

    // ── Verify workout exists and belongs to this coach ───────────────────
    const existing = await prisma.liftingWorkoutLog.findFirst({
      where: { id, coachId: coach.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Workout log not found." },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { status, actualRpe, notes, durationMinutes, exerciseLogs } =
      body as Record<string, unknown>;

    // ── Validate status if provided ───────────────────────────────────────
    if (
      status !== undefined &&
      (typeof status !== "string" ||
        !["IN_PROGRESS", "COMPLETED", "SKIPPED"].includes(status))
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid status. Must be IN_PROGRESS, COMPLETED, or SKIPPED.",
        },
        { status: 400 }
      );
    }

    // ── Build workout update data ─────────────────────────────────────────
    const workoutUpdate: Record<string, unknown> = {};

    if (status !== undefined) {
      workoutUpdate.status = status;
      if (status === "COMPLETED") {
        workoutUpdate.completedAt = new Date();
      }
    }
    if (actualRpe !== undefined) {
      workoutUpdate.actualRpe =
        typeof actualRpe === "number" ? actualRpe : null;
    }
    if (notes !== undefined) {
      workoutUpdate.notes =
        typeof notes === "string" && notes.trim().length > 0
          ? notes.trim()
          : null;
    }
    if (durationMinutes !== undefined) {
      workoutUpdate.durationMinutes =
        typeof durationMinutes === "number" ? durationMinutes : null;
    }

    // ── Transaction: update workout + upsert exercise logs ────────────────
    await prisma.$transaction(async (tx) => {
      // Update the workout log itself
      if (Object.keys(workoutUpdate).length > 0) {
        await tx.liftingWorkoutLog.update({
          where: { id },
          data: workoutUpdate as never,
        });
      }

      // Process exercise logs if provided
      if (Array.isArray(exerciseLogs)) {
        for (const log of exerciseLogs as Record<string, unknown>[]) {
          const logData = {
            exerciseName:
              typeof log.exerciseName === "string"
                ? log.exerciseName.trim()
                : "",
            order: typeof log.order === "number" ? log.order : 0,
            sets: typeof log.sets === "number" ? log.sets : null,
            reps: typeof log.reps === "number" ? log.reps : null,
            load: typeof log.load === "number" ? log.load : null,
            loadUnit:
              typeof log.loadUnit === "string" ? log.loadUnit : "lbs",
            duration:
              typeof log.duration === "number" ? log.duration : null,
            isSkipped: log.isSkipped === true,
            isAdded: log.isAdded === true,
            isModified: log.isModified === true,
            notes:
              typeof log.notes === "string" && log.notes.trim().length > 0
                ? log.notes.trim()
                : null,
          };

          if (typeof log.id === "string" && log.id.length > 0) {
            // Update existing exercise log
            await tx.liftingExerciseLog.update({
              where: { id: log.id as string },
              data: logData,
            });
          } else {
            // Create new ad-hoc exercise log
            await tx.liftingExerciseLog.create({
              data: {
                ...logData,
                workoutLogId: id,
                programExerciseId:
                  typeof log.programExerciseId === "string" &&
                  log.programExerciseId.length > 0
                    ? log.programExerciseId
                    : null,
              },
            });
          }
        }
      }
    });

    // ── Refetch and return the full updated workout log ───────────────────
    const updated = await prisma.liftingWorkoutLog.findUnique({
      where: { id },
      include: {
        exerciseLogs: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    logger.error("PATCH /api/lifting/workouts/[id]", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to save workout." },
      { status: 500 }
    );
  }
}
