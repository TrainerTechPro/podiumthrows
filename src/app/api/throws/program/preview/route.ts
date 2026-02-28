/**
 * POST /api/throws/program/preview
 *
 * Sandbox / test-profile endpoint: runs the Bondarchuk engine with
 * hypothetical athlete data and returns the FULL GeneratedProgram
 * (phases, weeks, sessions, prescriptions) WITHOUT saving anything to DB.
 *
 * Used by the Program Builder wizard in "Test Profile" mode.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { generateProgram, validateOnboarding } from "@/lib/throws/engine";
import type { OnboardingData, ProgramConfig } from "@/lib/throws/engine";
import { classifyBand, EVENT_CODE_MAP, GENDER_CODE_MAP } from "@/lib/throws/constants";
import type { EventCode, GenderCode } from "@/lib/throws/constants";

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
    const { onboardingData } = body as { onboardingData: OnboardingData };

    // Validate onboarding data
    const validation = validateOnboarding(onboardingData);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: "Validation failed", errors: validation.errors },
        { status: 400 },
      );
    }

    // Map event/gender to codes
    const eventCode: EventCode = EVENT_CODE_MAP[onboardingData.event];
    const genderCode: GenderCode = GENDER_CODE_MAP[onboardingData.gender];
    const distanceBand =
      classifyBand(eventCode, genderCode, onboardingData.competitionPr) ?? "0-999";
    const startDate = new Date().toISOString().slice(0, 10);

    // Build ProgramConfig with placeholder athleteId (engine never touches DB)
    const programConfig: ProgramConfig = {
      athleteId: "sandbox",
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
      yearsThowing: onboardingData.experience.yearsThowing,
      currentWeeklyVolume: onboardingData.experience.currentWeeklyVolume,

      // Equipment
      availableImplements: onboardingData.implements,
      facilities: onboardingData.facilities,

      // Lifting PRs
      liftingPrs: onboardingData.liftingPrs,
    };

    // Generate the program (pure function, no DB)
    const generated = generateProgram(programConfig);

    logger.info("Sandbox program preview generated", {
      context: "throws/program/preview",
      userId: user.userId,
      metadata: {
        event: onboardingData.event,
        totalWeeks: generated.totalWeeks,
        totalPhases: generated.summary.totalPhases,
        totalSessions: generated.summary.totalSessions,
      },
    });

    return NextResponse.json({
      success: true,
      data: { generated },
    });
  } catch (error) {
    logger.error("Preview program error", {
      context: "throws/program/preview",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to generate preview" },
      { status: 500 },
    );
  }
}
