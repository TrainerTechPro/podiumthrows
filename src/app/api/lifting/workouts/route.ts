import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

/** Parse a duration string like "30s" or "90s" to an integer (seconds). */
function parseDuration(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = String(raw).replace(/s$/i, "").trim();
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

/** Safely JSON.parse a nullable string. Returns null on failure. */
function safeJsonParse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/* ─── POST — start a new workout (create log with pre-populated exercises) ─ */

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const { programId, weekNumber, workoutNumber, date } = body as Record<
      string,
      unknown
    >;

    // ── Validate required fields ──────────────────────────────────────────
    if (typeof programId !== "string" || programId.trim().length === 0) {
      return NextResponse.json(
        { error: "programId is required." },
        { status: 400 }
      );
    }
    if (typeof weekNumber !== "number" || weekNumber < 1) {
      return NextResponse.json(
        { error: "weekNumber must be a positive number." },
        { status: 400 }
      );
    }
    if (typeof workoutNumber !== "number" || workoutNumber < 1) {
      return NextResponse.json(
        { error: "workoutNumber must be a positive number." },
        { status: 400 }
      );
    }
    if (typeof date !== "string" || date.trim().length === 0) {
      return NextResponse.json(
        { error: "date is required." },
        { status: 400 }
      );
    }

    // ── Fetch program with phases + exercises ─────────────────────────────
    const program = await prisma.liftingProgram.findFirst({
      where: { id: programId as string, coachId: coach.id },
      include: {
        phases: {
          include: { exercises: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!program) {
      return NextResponse.json(
        { error: "Program not found." },
        { status: 404 }
      );
    }

    // ── Determine which phase this weekNumber falls in ────────────────────
    const matchedPhase = program.phases.find(
      (p) => p.startWeek <= (weekNumber as number) && (weekNumber as number) <= p.endWeek
    );
    if (!matchedPhase) {
      return NextResponse.json(
        {
          error: `No phase covers week ${weekNumber}. Check program phase ranges.`,
        },
        { status: 400 }
      );
    }

    // ── Resolve RPE target for this workout slot ──────────────────────────
    const rpeTargets = safeJsonParse<string[]>(program.rpeTargets);
    const targetRpe =
      Array.isArray(rpeTargets) && (workoutNumber as number) - 1 < rpeTargets.length
        ? rpeTargets[(workoutNumber as number) - 1]
        : null;

    // ── Build pre-populated exercise logs ─────────────────────────────────
    const exerciseLogData: Prisma.LiftingExerciseLogCreateWithoutWorkoutLogInput[] =
      [];

    for (const exercise of matchedPhase.exercises) {
      // Query previous load for this exercise name
      const previousLog = await prisma.liftingExerciseLog.findFirst({
        where: {
          exerciseName: exercise.name,
          workoutLog: { coachId: coach.id },
          isSkipped: false,
        },
        orderBy: { createdAt: "desc" },
        select: { load: true },
      });
      const previousLoad = previousLog?.load ?? null;

      // Resolve duration and sets for isometric exercises with progressions
      let resolvedDuration: number | null = parseDuration(
        exercise.prescribedDuration
      );
      let resolvedSets: number = exercise.prescribedSets;

      if (exercise.isIsometric) {
        // Duration progression
        if (exercise.durationProgression) {
          const durationProg = safeJsonParse<Record<string, string[]>>(
            exercise.durationProgression
          );
          if (durationProg) {
            const weekKey = String(weekNumber);
            const weekDurations = durationProg[weekKey];
            if (
              Array.isArray(weekDurations) &&
              (workoutNumber as number) - 1 < weekDurations.length
            ) {
              const progValue = parseDuration(
                weekDurations[(workoutNumber as number) - 1]
              );
              if (progValue !== null) {
                resolvedDuration = progValue;
              }
            }
          }
        }

        // Sets progression
        if (exercise.setsProgression) {
          const setsProg = safeJsonParse<Record<string, string[]>>(
            exercise.setsProgression
          );
          if (setsProg) {
            const weekKey = String(weekNumber);
            const weekSets = setsProg[weekKey];
            if (
              Array.isArray(weekSets) &&
              (workoutNumber as number) - 1 < weekSets.length
            ) {
              const progSets = parseInt(
                weekSets[(workoutNumber as number) - 1],
                10
              );
              if (!isNaN(progSets) && progSets > 0) {
                resolvedSets = progSets;
              }
            }
          }
        }
      }

      // Parse reps from prescribedReps if available
      const parsedReps = exercise.prescribedReps
        ? parseInt(exercise.prescribedReps, 10)
        : null;
      const reps =
        parsedReps !== null && !isNaN(parsedReps) ? parsedReps : null;

      exerciseLogData.push({
        exerciseName: exercise.name,
        order: exercise.order,
        sets: resolvedSets,
        reps,
        duration: resolvedDuration,
        load: null,
        loadUnit: "lbs",
        previousLoad,
        isSkipped: false,
        isAdded: false,
        isModified: false,
        programExercise: { connect: { id: exercise.id } },
      });
    }

    // ── Create the workout log with nested exercise logs ──────────────────
    const workoutLog = await prisma.liftingWorkoutLog.create({
      data: {
        programId: programId as string,
        phaseId: matchedPhase.id,
        coachId: coach.id,
        weekNumber: weekNumber as number,
        workoutNumber: workoutNumber as number,
        targetRpe: targetRpe ?? null,
        date: (date as string).trim(),
        status: "IN_PROGRESS",
        exerciseLogs: {
          create: exerciseLogData,
        },
      },
      include: {
        exerciseLogs: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json(workoutLog, { status: 201 });
  } catch (err) {
    // Handle unique constraint violation (duplicate workout slot)
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Workout already started for this slot." },
        { status: 409 }
      );
    }

    logger.error("POST /api/lifting/workouts", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to start workout." },
      { status: 500 }
    );
  }
}
