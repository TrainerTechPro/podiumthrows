import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateProgram, validateOnboarding } from "@/lib/throws/engine";
import type { OnboardingData, ProgramConfig } from "@/lib/throws/engine";
import { classifyBand, EVENT_CODE_MAP, GENDER_CODE_MAP } from "@/lib/throws/constants";
import type { EventCode, GenderCode } from "@/lib/throws/constants";

// ── POST /api/throws/program/generate ────────────────────────────────
// Generate a new training program from onboarding data.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const athleteProfile = await prisma.athleteProfile.findUnique({
      where: { userId: user.userId },
      include: {
        throwsProfile: true,
        throwsTyping: true,
        equipmentInventory: true,
      },
    });

    if (!athleteProfile) {
      return NextResponse.json(
        { success: false, error: "No athlete profile found" },
        { status: 404 },
      );
    }

    const body = (await req.json()) as OnboardingData;

    // Validate
    const validation = validateOnboarding(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: "Validation failed", errors: validation.errors },
        { status: 400 },
      );
    }

    // Archive any existing active program
    await prisma.trainingProgram.updateMany({
      where: { athleteId: athleteProfile.id, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });

    // Map event/gender to codes
    const eventCode: EventCode = EVENT_CODE_MAP[body.event];
    const genderCode: GenderCode = GENDER_CODE_MAP[body.gender];
    const distanceBand = classifyBand(eventCode, genderCode, body.competitionPr) ?? "0-999";
    const startDate = new Date().toISOString().slice(0, 10);

    // Build ProgramConfig from onboarding data
    const programConfig: ProgramConfig = {
      athleteId: athleteProfile.id,
      event: body.event,
      eventCode,
      gender: body.gender,
      genderCode,
      competitionPr: body.competitionPr,
      distanceBand,
      startDate,
      targetDate: body.targetDate,
      goalDistance: body.goalDistance,

      // Schedule
      daysPerWeek: body.schedule.daysPerWeek,
      sessionsPerDay: body.schedule.sessionsPerDay,
      includeLift: body.schedule.includeLift,

      // Adaptation
      adaptationGroup: body.typing?.adaptationGroup ?? 2,
      sessionsToForm: body.typing?.sessionsToForm ?? 25,
      recommendedMethod: body.typing?.recommendedMethod ?? "complex",
      transferType: body.typing?.transferType,

      // Experience
      yearsThowing: body.experience.yearsThowing,
      currentWeeklyVolume: body.experience.currentWeeklyVolume,

      // Equipment
      availableImplements: body.implements,
      facilities: body.facilities,

      // Lifting PRs
      liftingPrs: body.liftingPrs,

      // Deficit analysis from ThrowsProfile
      deficitPrimary: athleteProfile.throwsProfile?.deficitPrimary ?? undefined,
      deficitSecondary: athleteProfile.throwsProfile?.deficitSecondary ?? undefined,
    };

    // Look up coach ID if current user is a coach
    let coachId: string | undefined;
    if (user.role === "COACH") {
      const coach = await prisma.coachProfile.findUnique({
        where: { userId: user.userId },
        select: { id: true },
      });
      coachId = coach?.id ?? undefined;
    }

    // Generate the program
    const generated = generateProgram(programConfig);

    // Save to database
    const program = await prisma.trainingProgram.create({
      data: {
        athleteId: athleteProfile.id,
        coachId,
        event: body.event,
        gender: body.gender,
        status: "ACTIVE",
        startDate,
        targetDate: body.targetDate,
        goalDistance: body.goalDistance,
        startingPr: body.competitionPr,
        daysPerWeek: programConfig.daysPerWeek,
        sessionsPerDay: programConfig.sessionsPerDay,
        includeLift: programConfig.includeLift,
        adaptationGroup: programConfig.adaptationGroup,
        sessionsToForm: programConfig.sessionsToForm,
        recommendedMethod: programConfig.recommendedMethod,
        currentWeekNumber: 1,
        currentComplexNum: 1,
        generationConfig: JSON.stringify(programConfig),
      },
    });

    // Save phases and sessions
    for (const genPhase of generated.phases) {
      const phase = await prisma.programPhase.create({
        data: {
          programId: program.id,
          phase: genPhase.phase,
          phaseOrder: genPhase.phaseOrder,
          startWeek: genPhase.startWeek,
          endWeek: genPhase.endWeek,
          durationWeeks: genPhase.durationWeeks,
          throwsPerWeekTarget: genPhase.throwsPerWeekTarget,
          strengthDaysTarget: genPhase.strengthDaysTarget,
          cePercent: genPhase.cePercent,
          sdPercent: genPhase.sdPercent,
          spPercent: genPhase.spPercent,
          gpPercent: genPhase.gpPercent,
          lightPercent: genPhase.lightPercent,
          compPercent: genPhase.compPercent,
          heavyPercent: genPhase.heavyPercent,
          exerciseComplex: JSON.stringify(genPhase.exerciseComplex),
          status: genPhase.phaseOrder === 1 ? "ACTIVE" : "PLANNED",
        },
      });

      // Set current phase
      if (genPhase.phaseOrder === 1) {
        await prisma.trainingProgram.update({
          where: { id: program.id },
          data: { currentPhaseId: phase.id },
        });
      }

      // Save sessions for this phase
      for (const genWeek of genPhase.weeks) {
        for (const genSession of genWeek.sessions) {
          await prisma.programSession.create({
            data: {
              programId: program.id,
              phaseId: phase.id,
              weekNumber: genWeek.weekNumber,
              dayOfWeek: genSession.dayOfWeek,
              dayType: genSession.dayType,
              sessionType: genSession.sessionType,
              focusLabel: genSession.focusLabel,
              throwsPrescription: JSON.stringify(genSession.throws),
              strengthPrescription: genSession.strength.length > 0
                ? JSON.stringify(genSession.strength)
                : null,
              warmupPrescription: genSession.warmup.length > 0
                ? JSON.stringify(genSession.warmup)
                : null,
              totalThrowsTarget: genSession.totalThrowsTarget,
              estimatedDuration: genSession.estimatedDuration,
              status: "PLANNED",
            },
          });
        }
      }
    }

    logger.info("Program generated", {
      context: "throws/program/generate",
      userId: user.userId,
      metadata: {
        programId: program.id,
        totalWeeks: generated.totalWeeks,
        totalPhases: generated.summary.totalPhases,
        totalSessions: generated.summary.totalSessions,
        estimatedTotalThrows: generated.summary.estimatedTotalThrows,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        programId: program.id,
        totalWeeks: generated.totalWeeks,
        summary: generated.summary,
      },
    });
  } catch (error) {
    logger.error("Generate program error", {
      context: "throws/program/generate",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to generate program" },
      { status: 500 },
    );
  }
}
