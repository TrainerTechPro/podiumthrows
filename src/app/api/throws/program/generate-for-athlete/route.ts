/**
 * POST /api/throws/program/generate-for-athlete
 *
 * Coach-facing endpoint: generates a Bondarchuk training program for a specific athlete.
 * Accepts { athleteId, onboardingData } and creates the full macrocycle.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateProgram, validateOnboarding } from "@/lib/throws/engine";
import type { OnboardingData, ProgramConfig } from "@/lib/throws/engine";
import { classifyBand, EVENT_CODE_MAP, GENDER_CODE_MAP } from "@/lib/throws/constants";
import type { EventCode, GenderCode } from "@/lib/throws/constants";
import { validateGeneratedProgram } from "@/lib/throws/engine/schemas";
import { auditGeneratedProgram, applyAdjustments } from "@/lib/throws/engine/validate-program-output";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }
    if (user.role !== "COACH") {
      return NextResponse.json(
        { success: false, error: "Coaches only" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { athleteId, onboardingData } = body as {
      athleteId: string;
      onboardingData: OnboardingData;
    };

    if (!athleteId) {
      return NextResponse.json(
        { success: false, error: "athleteId is required" },
        { status: 400 },
      );
    }

    // Authorization: coach must own this athlete
    const hasAccess = await canAccessAthlete(user.userId, "COACH", athleteId);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    // Fetch athlete profile
    const athleteProfile = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      include: {
        throwsProfiles: true,
        throwsTyping: true,
        equipmentInventory: true,
      },
    });

    if (!athleteProfile) {
      return NextResponse.json(
        { success: false, error: "Athlete profile not found" },
        { status: 404 },
      );
    }

    // Validate onboarding data
    const validation = validateOnboarding(onboardingData);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: "Validation failed", errors: validation.errors },
        { status: 400 },
      );
    }

    // Archive any existing active program for this athlete
    await prisma.trainingProgram.updateMany({
      where: { athleteId: athleteProfile.id, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });

    // Map event/gender to codes
    const eventCode: EventCode = EVENT_CODE_MAP[onboardingData.event];
    const genderCode: GenderCode = GENDER_CODE_MAP[onboardingData.gender];
    const distanceBand =
      classifyBand(eventCode, genderCode, onboardingData.competitionPr) ?? "0-999";
    const startDate = new Date().toISOString().slice(0, 10);

    // Get coach ID
    const coach = await prisma.coachProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });
    const coachId = coach?.id ?? undefined;

    // Build ProgramConfig
    const programConfig: ProgramConfig = {
      athleteId: athleteProfile.id,
      coachId,
      event: onboardingData.event,
      eventCode,
      gender: onboardingData.gender,
      genderCode,
      competitionPr: onboardingData.competitionPr,
      distanceBand,
      startDate,
      targetDate: onboardingData.targetDate,
      goalDistance: onboardingData.goalDistance,

      // Schedule
      daysPerWeek: onboardingData.schedule.daysPerWeek,
      sessionsPerDay: onboardingData.schedule.sessionsPerDay,
      includeLift: onboardingData.schedule.includeLift,

      // Adaptation
      adaptationGroup: onboardingData.typing?.adaptationGroup ?? 2,
      sessionsToForm: onboardingData.typing?.sessionsToForm ?? 25,
      recommendedMethod: onboardingData.typing?.recommendedMethod ?? "complex",
      transferType: onboardingData.typing?.transferType,

      // Experience
      yearsThrowing: onboardingData.experience.yearsThrowing,
      currentWeeklyVolume: onboardingData.experience.currentWeeklyVolume,

      // Equipment
      availableImplements: onboardingData.implements,
      facilities: onboardingData.facilities,

      // Lifting PRs
      liftingPrs: onboardingData.liftingPrs,

      // Deficit analysis from ThrowsProfile
      deficitPrimary: athleteProfile.throwsProfiles?.[0]?.deficitPrimary ?? undefined,
      deficitSecondary: athleteProfile.throwsProfiles?.[0]?.deficitSecondary ?? undefined,
    };

    // Generate the program
    let generated = generateProgram(programConfig);

    // Validate engine output before persisting
    const engineValidation = validateGeneratedProgram(generated);
    if (!engineValidation.valid) {
      logger.error("Engine output validation failed", {
        context: "throws/program/generate-for-athlete",
        metadata: { errors: engineValidation.errors },
      });
      return NextResponse.json(
        { success: false, error: "Program generation produced invalid output" },
        { status: 500 },
      );
    }

    // Post-generation safety audit (ACWR, spike detection, absolute ceiling)
    const audit = auditGeneratedProgram(generated);
    if (!audit.safe) {
      logger.info("Safety audit found violations, applying adjustments", {
        context: "throws/program/generate-for-athlete",
        metadata: { warnings: audit.warnings, adjustmentCount: audit.adjustments.length },
      });
      generated = applyAdjustments(generated, audit.adjustments);
    }

    // Save to database in a transaction (all-or-nothing)
    const program = await prisma.$transaction(async (tx) => {
      const prog = await tx.trainingProgram.create({
        data: {
          athleteId: athleteProfile.id,
          coachId,
          event: onboardingData.event,
          gender: onboardingData.gender,
          status: "ACTIVE",
          startDate,
          targetDate: onboardingData.targetDate,
          goalDistance: onboardingData.goalDistance,
          startingPr: onboardingData.competitionPr,
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
        const phase = await tx.programPhase.create({
          data: {
            programId: prog.id,
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
          await tx.trainingProgram.update({
            where: { id: prog.id },
            data: { currentPhaseId: phase.id },
          });
        }

        // Save sessions for this phase
        for (const genWeek of genPhase.weeks) {
          for (const genSession of genWeek.sessions) {
            await tx.programSession.create({
              data: {
                programId: prog.id,
                phaseId: phase.id,
                weekNumber: genWeek.weekNumber,
                dayOfWeek: genSession.dayOfWeek,
                dayType: genSession.dayType,
                sessionType: genSession.sessionType,
                focusLabel: genSession.focusLabel,
                throwsPrescription: JSON.stringify(genSession.throws),
                strengthPrescription:
                  genSession.strength.length > 0
                    ? JSON.stringify(genSession.strength)
                    : null,
                warmupPrescription:
                  genSession.warmup.length > 0
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

      return prog;
    });

    logger.info("Program generated for athlete by coach", {
      context: "throws/program/generate-for-athlete",
      userId: user.userId,
      metadata: {
        programId: program.id,
        athleteId: athleteProfile.id,
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
    logger.error("Generate program for athlete error", {
      context: "throws/program/generate-for-athlete",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to generate program" },
      { status: 500 },
    );
  }
}
