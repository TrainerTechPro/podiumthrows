import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { canAccessProgram } from "@/lib/authorize";
import { rotateComplex, complexDiff } from "@/lib/throws/engine";
import type { ProgramConfig, ExerciseComplexEntry } from "@/lib/throws/engine";
import type { TrainingPhase } from "@/lib/throws/constants";

interface Params {
  params: Promise<{ programId: string }>;
}

// ── POST /api/throws/program/[programId]/rotate-complex ──────────────
// Apply exercise complex rotation. Generates a new complex that differs
// meaningfully from the current one, then updates the active phase.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { programId } = await params;

    // Fetch program with active phase and generation config
    const program = await prisma.trainingProgram.findUnique({
      where: { id: programId },
      include: {
        phases: {
          orderBy: { phaseOrder: "asc" },
        },
      },
    });

    if (!program) {
      return NextResponse.json(
        { success: false, error: "Program not found" },
        { status: 404 },
      );
    }

    // Verify ownership (supports both athletes and their coaches)
    const allowed = await canAccessProgram(user.userId, user.role as "COACH" | "ATHLETE", programId);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 },
      );
    }

    const activePhase = program.phases.find(
      (p) => p.id === program.currentPhaseId,
    );
    if (!activePhase) {
      return NextResponse.json(
        { success: false, error: "No active phase found" },
        { status: 400 },
      );
    }

    // Parse the current exercise complex
    let currentComplex: ExerciseComplexEntry[] = [];
    try {
      const parsed = JSON.parse(activePhase.exerciseComplex || "[]");
      currentComplex = Array.isArray(parsed) ? parsed : [];
    } catch {
      /* empty */
    }

    // Gather previous complexes from all phases
    const allPreviousComplexes: ExerciseComplexEntry[][] = program.phases
      .filter((p) => p.id !== activePhase.id)
      .map((p) => {
        try {
          const parsed = JSON.parse(p.exerciseComplex || "[]");
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })
      .filter((c) => c.length > 0);

    // Parse generation config for programConfig
    let generationConfig: Record<string, unknown> = {};
    try {
      generationConfig = JSON.parse(program.generationConfig || "{}");
    } catch {
      /* empty */
    }

    // Build a minimal ProgramConfig from generation config + program data
    const programConfig: ProgramConfig = {
      athleteId: program.athleteId,
      event: (generationConfig.event as ProgramConfig["event"]) ?? "HAMMER",
      eventCode: (generationConfig.eventCode as ProgramConfig["eventCode"]) ?? "HT",
      gender: (generationConfig.gender as ProgramConfig["gender"]) ?? "MALE",
      genderCode: (generationConfig.genderCode as ProgramConfig["genderCode"]) ?? "M",
      competitionPr: (generationConfig.competitionPr as number) ?? 55,
      distanceBand: (generationConfig.distanceBand as string) ?? "50-59",
      startDate: program.startDate,
      targetDate: program.targetDate ?? "",
      goalDistance: program.goalDistance ?? 0,
      daysPerWeek: program.daysPerWeek,
      sessionsPerDay: program.sessionsPerDay,
      includeLift: program.includeLift,
      adaptationGroup: program.adaptationGroup ?? 2,
      sessionsToForm: program.sessionsToForm ?? 30,
      recommendedMethod: program.recommendedMethod ?? "COMPLEX",
      transferType: (generationConfig.transferType as string) ?? undefined,
      availableImplements: (generationConfig.availableImplements as ProgramConfig["availableImplements"]) ?? [],
      facilities: (generationConfig.facilities as ProgramConfig["facilities"]) ?? {
        hasCage: true,
        hasRing: true,
        hasFieldAccess: true,
        hasGym: true,
        gymEquipment: {
          barbell: true,
          squatRack: true,
          platform: true,
          dumbbells: true,
          cables: true,
          medBalls: true,
          boxes: true,
          bands: true,
        },
      },
      liftingPrs: (generationConfig.liftingPrs as ProgramConfig["liftingPrs"]) ?? {
        bodyWeightKg: 90,
      },
      yearsThowing: (generationConfig.yearsThowing as number) ?? 3,
      deficitPrimary: (generationConfig.deficitPrimary as string) ?? undefined,
      deficitSecondary: (generationConfig.deficitSecondary as string) ?? undefined,
    };

    // Rotate the complex
    const newComplex = rotateComplex({
      programConfig,
      currentComplex,
      allPreviousComplexes,
      phase: activePhase.phase as TrainingPhase,
    });

    // Get diff summary
    const diff = complexDiff(currentComplex, newComplex);

    // Update the active phase with new complex
    await prisma.programPhase.update({
      where: { id: activePhase.id },
      data: {
        exerciseComplex: JSON.stringify(newComplex),
      },
    });

    // Increment complex number on program
    await prisma.trainingProgram.update({
      where: { id: programId },
      data: {
        currentComplexNum: (program.currentComplexNum ?? 1) + 1,
      },
    });

    // Mark any pending adaptation checkpoint as applied
    await prisma.adaptationCheckpoint.updateMany({
      where: {
        programId,
        recommendation: "ROTATE_COMPLEX",
        applied: false,
      },
      data: { applied: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        newComplex,
        diff,
        complexNumber: (program.currentComplexNum ?? 1) + 1,
      },
    });
  } catch (error) {
    logger.error("Rotate complex error", {
      context: "throws/program/rotate-complex",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to rotate exercise complex" },
      { status: 500 },
    );
  }
}
