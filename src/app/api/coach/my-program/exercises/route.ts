/**
 * GET /api/coach/my-program/exercises
 *
 * Returns all exercises in the Bondarchuk correlation database
 * for the coach's event/gender/band, with current program context.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getRankedExercises } from "@/lib/throws/correlations";
import type { ProgramConfig } from "@/lib/throws/engine/types";
import type { EventCode, GenderCode } from "@/lib/throws/constants";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "COACH") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 404 },
      );
    }

    // Fetch active coach self-program
    const program = await prisma.trainingProgram.findFirst({
      where: {
        coachId: coach.id,
        isCoachSelfProgram: true,
        status: "ACTIVE",
      },
      select: {
        generationConfig: true,
        currentPhaseId: true,
        phases: {
          where: { status: "ACTIVE" },
          select: { exerciseComplex: true },
        },
      },
    });

    if (!program) {
      return NextResponse.json(
        { success: false, error: "No active program found" },
        { status: 404 },
      );
    }

    let config: ProgramConfig;
    try {
      config = JSON.parse(program.generationConfig || "{}");
    } catch {
      return NextResponse.json(
        { success: false, error: "Corrupt program configuration" },
        { status: 500 },
      );
    }

    // Validate essential config fields (JSON valid but shape may be incomplete)
    if (!config.eventCode || !config.genderCode || !config.distanceBand) {
      return NextResponse.json(
        { success: false, error: "Incomplete program configuration — try regenerating your program" },
        { status: 422 },
      );
    }

    // Get ranked exercises from correlation database
    const exercises = getRankedExercises(
      config.eventCode as EventCode,
      config.genderCode as GenderCode,
      config.distanceBand,
    );

    // Get current complex exercises
    const currentComplexNames: Set<string> = new Set();
    for (const phase of program.phases) {
      let complex: Array<{ name: string }> = [];
      try {
        complex = JSON.parse(phase.exerciseComplex || "[]");
      } catch { /* corrupt data — skip */ }
      for (const ex of complex) {
        currentComplexNames.add(ex.name);
      }
    }

    // Get personal correlations from config if available
    const personalCorrelations = config.personalCorrelations ?? [];
    const personalCorrelationMap = new Map(
      personalCorrelations.map((pc) => [pc.exercise, pc]),
    );

    // Enhance exercises with program context
    const enhanced = exercises.map((ex) => {
      const pc = personalCorrelationMap.get(ex.exercise);
      return {
        exercise: ex.exercise,
        type: ex.type,
        correlation: ex.correlation,
        absCorrelation: ex.absCorrelation,
        isInCurrentComplex: currentComplexNames.has(ex.exercise),
        personalR: pc?.personalR ?? null,
        blendedR: pc?.blendedR ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        exercises: enhanced,
        eventCode: config.eventCode,
        genderCode: config.genderCode,
        distanceBand: config.distanceBand,
        totalExercises: enhanced.length,
      },
    });
  } catch (error) {
    logger.error("Coach my-program exercises error", {
      context: "coach/my-program/exercises",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to load exercises" },
      { status: 500 },
    );
  }
}
