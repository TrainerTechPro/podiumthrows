import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { canAccessProgram } from "@/lib/authorize";
import { generateWeek } from "@/lib/throws/engine";
import type {
  ProgramConfig,
  ExerciseComplexEntry,
  WeekGenConfig,
} from "@/lib/throws/engine";

interface Params {
  params: Promise<{ programId: string }>;
}

// ── POST /api/throws/program/[programId]/regenerate ──────────────────
// Regenerate remaining (PLANNED) sessions from the current week onward.
// Useful after schedule changes, complex rotation, or volume adjustments.
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

    const program = await prisma.trainingProgram.findUnique({
      where: { id: programId },
      include: {
        phases: {
          where: { status: "ACTIVE" },
          take: 1,
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

    const activePhase = program.phases[0];
    if (!activePhase) {
      return NextResponse.json(
        { success: false, error: "No active phase found" },
        { status: 400 },
      );
    }

    // Parse exercise complex
    let exerciseComplex: ExerciseComplexEntry[] = [];
    try {
      const parsed = JSON.parse(activePhase.exerciseComplex || "[]");
      exerciseComplex = Array.isArray(parsed) ? parsed : [];
    } catch {
      /* empty */
    }

    // Parse generation config
    let generationConfig: Record<string, unknown> = {};
    try {
      generationConfig = JSON.parse(program.generationConfig || "{}");
    } catch {
      /* empty */
    }

    const programConfig: ProgramConfig = {
      athleteId: program.athleteId ?? undefined,
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
      yearsThrowing: (generationConfig.yearsThrowing as number) ?? (generationConfig.yearsThowing as number) ?? 3,
      deficitPrimary: (generationConfig.deficitPrimary as string) ?? undefined,
      deficitSecondary: (generationConfig.deficitSecondary as string) ?? undefined,
    };

    // Delete all PLANNED sessions from current week onward
    const deletedSessions = await prisma.programSession.deleteMany({
      where: {
        programId,
        phaseId: activePhase.id,
        status: "PLANNED",
        weekNumber: { gte: program.currentWeekNumber },
      },
    });

    // Calculate program start date for scheduling
    const programStartDate = program.startDate;

    // Regenerate sessions for remaining weeks (batch insert)
    const sessionsToCreate: {
      programId: string;
      phaseId: string;
      weekNumber: number;
      dayOfWeek: number;
      dayType: string;
      scheduledDate: string;
      sessionType: string;
      focusLabel: string;
      throwsPrescription: string;
      strengthPrescription: string;
      warmupPrescription: string;
      totalThrowsTarget: number;
      estimatedDuration: number;
      status: string;
    }[] = [];

    for (
      let week = program.currentWeekNumber;
      week <= activePhase.endWeek;
      week++
    ) {
      const weekConfig: WeekGenConfig = {
        weekNumber: week,
        phase: activePhase.phase as WeekGenConfig["phase"],
        daysPerWeek: program.daysPerWeek,
        sessionsPerDay: program.sessionsPerDay,
        includeLift: program.includeLift,
        throwsPerWeekTarget: activePhase.throwsPerWeekTarget,
        strengthDaysTarget: activePhase.strengthDaysTarget,
        exerciseComplex,
        programConfig,
      };

      const generatedWeek = generateWeek(weekConfig);

      // Calculate scheduled dates
      const weekStartDate = new Date(programStartDate);
      weekStartDate.setDate(
        weekStartDate.getDate() + (week - 1) * 7,
      );

      for (const session of generatedWeek.sessions) {
        const scheduledDate = new Date(weekStartDate);
        scheduledDate.setDate(
          scheduledDate.getDate() + (session.dayOfWeek - 1),
        );

        sessionsToCreate.push({
          programId,
          phaseId: activePhase.id,
          weekNumber: session.weekNumber,
          dayOfWeek: session.dayOfWeek,
          dayType: session.dayType,
          scheduledDate: scheduledDate.toISOString().split("T")[0],
          sessionType: session.sessionType,
          focusLabel: session.focusLabel,
          throwsPrescription: JSON.stringify(session.throws),
          strengthPrescription: JSON.stringify(session.strength),
          warmupPrescription: JSON.stringify(session.warmup),
          totalThrowsTarget: session.totalThrowsTarget,
          estimatedDuration: session.estimatedDuration,
          status: "PLANNED",
        });
      }
    }

    await prisma.programSession.createMany({ data: sessionsToCreate });
    const totalGenerated = sessionsToCreate.length;

    return NextResponse.json({
      success: true,
      data: {
        deletedCount: deletedSessions.count,
        generatedCount: totalGenerated,
        fromWeek: program.currentWeekNumber,
        toWeek: activePhase.endWeek,
      },
    });
  } catch (error) {
    logger.error("Regenerate sessions error", {
      context: "throws/program/regenerate",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to regenerate sessions" },
      { status: 500 },
    );
  }
}
