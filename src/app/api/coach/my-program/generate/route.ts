/**
 * POST /api/coach/my-program/generate
 *
 * Generates a Bondarchuk training program for a coach's personal training.
 * Mirrors the generate-for-athlete pattern but with isCoachSelfProgram = true.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateProgram, validateOnboarding } from "@/lib/throws/engine";
import type { OnboardingData, ProgramConfig } from "@/lib/throws/engine";
import { classifyBand, EVENT_CODE_MAP, GENDER_CODE_MAP } from "@/lib/throws/constants";
import type { EventCode, GenderCode } from "@/lib/throws/constants";
import { validateGeneratedProgram } from "@/lib/throws/engine/schemas";
import {
  auditGeneratedProgram,
  applyAdjustments,
} from "@/lib/throws/engine/validate-program-output";

interface ReasoningCard {
  id: string;
  title: string;
  brief: string;
  details: string;
  category: "phase" | "volume" | "exercise" | "taper" | "deficit";
  reference?: string;
}

function buildReasoningCards(
  config: ProgramConfig,
  generated: { phases: Array<{ phase: string; durationWeeks: number; throwsPerWeekTarget: number; exerciseComplex: Array<{ name: string; classification: string; correlationR?: number }> }>; totalWeeks: number },
): ReasoningCard[] {
  const cards: ReasoningCard[] = [];

  // Adaptation group card
  const groupLabels: Record<number, string> = {
    1: "Fast (Group 1)",
    2: "Moderate (Group 2)",
    3: "Slow (Group 3)",
  };
  cards.push({
    id: "adaptation-group",
    title: `${groupLabels[config.adaptationGroup] ?? "Group " + config.adaptationGroup} Adaptation`,
    brief: `Your typing indicates ${config.sessionsToForm} sessions to peak form.`,
    details: `Adaptation group ${config.adaptationGroup} means exercise complexes are designed to last approximately ${config.sessionsToForm} sessions before rotation. Phase durations are scaled accordingly — faster adapters get shorter phases, slower adapters get longer ones. Method: ${config.recommendedMethod}.`,
    category: "phase",
    reference: "Bondarchuk Transfer of Training, Ch. 8",
  });

  // Distance band card
  cards.push({
    id: "distance-band",
    title: `${config.distanceBand} Distance Band`,
    brief: `Based on your ${config.competitionPr}m PR in ${config.event}.`,
    details: `Your competition PR of ${config.competitionPr}m places you in the ${config.distanceBand} distance band. Exercise correlations, implement selection, and volume targets are all calibrated for this performance level. Goal: ${config.goalDistance}m.`,
    category: "volume",
  });

  // Phase cards
  for (const phase of generated.phases) {
    cards.push({
      id: `phase-${phase.phase.toLowerCase()}`,
      title: `${phase.durationWeeks}-Week ${phase.phase.charAt(0) + phase.phase.slice(1).toLowerCase()}`,
      brief: `${phase.throwsPerWeekTarget} throws/week target with ${phase.exerciseComplex.length} exercises.`,
      details: `The ${phase.phase.toLowerCase()} phase runs for ${phase.durationWeeks} weeks with a target of ${phase.throwsPerWeekTarget} throws per week. This phase duration is based on your adaptation group (${config.adaptationGroup}) and the ${generated.totalWeeks}-week program timeline from ${config.startDate} to ${config.targetDate}.`,
      category: "phase",
    });
  }

  // Volume card
  const totalThrows = generated.phases.reduce(
    (sum, p) => sum + p.throwsPerWeekTarget * p.durationWeeks,
    0,
  );
  cards.push({
    id: "volume-plan",
    title: "Volume Progression",
    brief: `~${totalThrows} total throws across ${generated.totalWeeks} weeks.`,
    details: `Volume is ramped progressively across phases: ${generated.phases.map((p) => `${p.phase.toLowerCase()} ${p.throwsPerWeekTarget}/wk`).join(" → ")}. ${config.currentWeeklyVolume ? `Starting from your current ~${config.currentWeeklyVolume} throws/week to avoid injury spikes.` : "Volume will start conservatively and ramp up."}`,
    category: "volume",
    reference: "Bondarchuk Vol. IV, Volume Scaling",
  });

  // Implement distribution card
  const heavyImpls = config.availableImplements.filter(
    (i) => i.weightKg > 7,
  ).length;
  const lightImpls = config.availableImplements.filter(
    (i) => i.weightKg < 7,
  ).length;
  cards.push({
    id: "implement-dist",
    title: "Implement Distribution",
    brief: `${config.availableImplements.length} implements: ${heavyImpls} heavy, ${lightImpls} light.`,
    details: `Implements are distributed per Bondarchuk\'s descending weight protocol — heavy implements always before light within a session. The 15-20% weight differential rule is enforced to ensure transfer, not separate adaptation.`,
    category: "exercise",
    reference: "Bondarchuk Vol. IV, p.114-117",
  });

  // Exercise complex card
  const firstPhase = generated.phases[0];
  if (firstPhase?.exerciseComplex?.length > 0) {
    const topExercises = firstPhase.exerciseComplex
      .slice(0, 5)
      .map((e) => `${e.name} (${e.classification}${e.correlationR ? `, r=${e.correlationR.toFixed(2)}` : ""})`)
      .join(", ");
    cards.push({
      id: "exercise-selection",
      title: "Exercise Complex Selection",
      brief: `Top exercises selected by correlation strength for your band.`,
      details: `Initial complex: ${topExercises}. Exercises are ranked by their correlation coefficient for ${config.event} athletes in the ${config.distanceBand} band (${config.gender}). ${config.transferType ? `Your transfer type (${config.transferType}) influences exercise weighting.` : ""}`,
      category: "exercise",
      reference: "Bondarchuk Correlation Database",
    });
  }

  // Timeline card
  const weeksToTarget = generated.totalWeeks;
  cards.push({
    id: "timeline",
    title: `${weeksToTarget}-Week Program`,
    brief: `Target: ${config.goalDistance}m by ${config.targetDate}.`,
    details: `Your ${weeksToTarget}-week macrocycle runs from ${config.startDate} to ${config.targetDate}, structured as ${generated.phases.length} phases: ${generated.phases.map((p) => `${p.phase.toLowerCase()} (wk ${p.durationWeeks})`).join(" → ")}. Training ${config.daysPerWeek} days/week, ${config.sessionsPerDay} session(s)/day${config.includeLift ? " with integrated strength work" : ""}.`,
    category: "phase",
  });

  return cards;
}

export async function POST(req: NextRequest) {
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 },
      );
    }
    const onboardingData = body as OnboardingData & {
      shortTermGoal?: string;
      longTermGoal?: string;
      longTermDistance?: number;
      longTermDate?: string;
      competitions?: Array<{ name: string; date: string; event: string; priority: string }>;
      mobilityRegions?: Array<{ area: string; severity: string; notes: string }>;
    };

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

    // Build ProgramConfig (no athleteId for coach self-program)
    const programConfig: ProgramConfig = {
      coachId: coach.id,
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
      recoveryProfile: onboardingData.typing?.recoveryProfile,

      // Experience
      yearsThrowing: onboardingData.experience.yearsThrowing,
      currentWeeklyVolume: onboardingData.experience.currentWeeklyVolume,

      // Equipment
      availableImplements: onboardingData.implements,
      facilities: onboardingData.facilities,

      // Lifting PRs
      liftingPrs: onboardingData.liftingPrs,
    };

    // Generate the program
    let generated = generateProgram(programConfig);

    // Validate engine output
    const engineValidation = validateGeneratedProgram(generated);
    if (!engineValidation.valid) {
      logger.error("Engine output validation failed for coach self-program", {
        context: "coach/my-program/generate",
        metadata: { errors: engineValidation.errors },
      });
      return NextResponse.json(
        { success: false, error: "Program generation produced invalid output" },
        { status: 500 },
      );
    }

    // Post-generation safety audit
    const audit = auditGeneratedProgram(generated);
    if (!audit.safe) {
      logger.info("Safety audit found violations, applying adjustments", {
        context: "coach/my-program/generate",
        metadata: { warnings: audit.warnings, adjustmentCount: audit.adjustments.length },
      });
      generated = applyAdjustments(generated, audit.adjustments);
    }

    // Build reasoning cards
    const reasoningCards = buildReasoningCards(programConfig, generated);

    // Save to database in a transaction
    const program = await prisma.$transaction(async (tx) => {
      // Archive any existing active coach self-programs (inside tx for rollback safety)
      await tx.trainingProgram.updateMany({
        where: {
          coachId: coach.id,
          isCoachSelfProgram: true,
          status: "ACTIVE",
        },
        data: { status: "ARCHIVED" },
      });

      const prog = await tx.trainingProgram.create({
        data: {
          coachId: coach.id,
          isCoachSelfProgram: true,
          event: onboardingData.event,
          gender: onboardingData.gender,
          status: "ACTIVE",
          startDate,
          targetDate: onboardingData.targetDate,
          goalDistance: onboardingData.goalDistance,
          startingPr: onboardingData.competitionPr,

          // Coach program enrichments
          shortTermGoalLabel: onboardingData.shortTermGoal || null,
          longTermGoalLabel: onboardingData.longTermGoal || null,
          longTermGoalDistance: onboardingData.longTermDistance || null,
          longTermGoalDate: onboardingData.longTermDate || null,
          competitionCalendar: onboardingData.competitions
            ? JSON.stringify(onboardingData.competitions)
            : null,
          mobilityNotes: onboardingData.mobilityRegions
            ? JSON.stringify({ regions: onboardingData.mobilityRegions })
            : null,

          daysPerWeek: programConfig.daysPerWeek,
          sessionsPerDay: programConfig.sessionsPerDay,
          includeLift: programConfig.includeLift,
          adaptationGroup: programConfig.adaptationGroup,
          sessionsToForm: programConfig.sessionsToForm,
          recommendedMethod: programConfig.recommendedMethod,
          currentWeekNumber: 1,
          currentComplexNum: 1,
          generationConfig: JSON.stringify({
            ...programConfig,
            reasoningCards,
          }),
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

        // Bulk-create sessions for this phase
        const sessionData = genPhase.weeks.flatMap((genWeek) =>
          genWeek.sessions.map((genSession) => ({
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
            status: "PLANNED" as const,
          })),
        );
        if (sessionData.length > 0) {
          await tx.programSession.createMany({ data: sessionData });
        }
      }

      return prog;
    });

    logger.info("Coach self-program generated", {
      context: "coach/my-program/generate",
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
        reasoningCards,
      },
    });
  } catch (error) {
    logger.error("Coach self-program generate error", {
      context: "coach/my-program/generate",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to generate program" },
      { status: 500 },
    );
  }
}
