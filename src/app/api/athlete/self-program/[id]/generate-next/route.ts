/**
 * POST /api/athlete/self-program/[id]/generate-next
 *
 * Rolling generation: appends the next phase to an existing self-generated
 * training program. Cycles Accumulation -> Transmutation -> Realization -> loop,
 * or enters Competition phase if an A-meet is within 2 weeks.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { canAccessSelfProgram } from "@/lib/authorize";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { buildProgramConfig } from "@/lib/self-program/adapter";
import { generatePhase } from "@/lib/throws/engine";
import type { TrainingPhase } from "@/lib/throws/constants";
import type { TypingSnapshot, PhaseGenConfig } from "@/lib/throws/engine/types";

type RouteContext = { params: Promise<{ id: string }> };

/** Standard Bondarchuk phase cycle (Competition is triggered by meet proximity). */
const PHASE_CYCLE: TrainingPhase[] = [
  "ACCUMULATION",
  "TRANSMUTATION",
  "REALIZATION",
];

/** Default durations in weeks per phase type. */
const DEFAULT_PHASE_DURATION: Record<TrainingPhase, number> = {
  ACCUMULATION: 4,
  TRANSMUTATION: 3,
  REALIZATION: 2,
  COMPETITION: 2,
};

/**
 * Check if any A-meet is within `withinDays` days from now.
 */
function hasUpcomingAMeet(
  competitionDates: unknown,
  withinDays: number,
): boolean {
  if (!Array.isArray(competitionDates) || competitionDates.length === 0) {
    return false;
  }

  const now = Date.now();
  const cutoff = now + withinDays * 24 * 60 * 60 * 1000;

  return (competitionDates as Array<{ date: string; priority: string }>).some(
    (c) =>
      c.priority === "A_MEET" &&
      new Date(c.date).getTime() > now &&
      new Date(c.date).getTime() <= cutoff,
  );
}

/**
 * Determine the next phase type based on the current phase.
 * If an A-meet is within 14 days of the next phase's end, switch to COMPETITION.
 */
function determineNextPhase(
  currentPhase: string,
  competitionDates: unknown,
): TrainingPhase {
  // If an A-meet is within 2 weeks, go to COMPETITION
  if (hasUpcomingAMeet(competitionDates, 14)) {
    return "COMPETITION";
  }

  // Standard cycle
  const currentIdx = PHASE_CYCLE.indexOf(currentPhase as TrainingPhase);
  if (currentIdx === -1) {
    // Unknown or COMPETITION phase — restart cycle
    return "ACCUMULATION";
  }

  // Next in cycle, wrapping around
  return PHASE_CYCLE[(currentIdx + 1) % PHASE_CYCLE.length];
}

export async function POST(
  _req: NextRequest,
  { params }: RouteContext,
) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canAccess = await canAccessSelfProgram(session.userId);
    if (!canAccess) {
      return NextResponse.json(
        { error: "Self-programming not enabled" },
        { status: 403 },
      );
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        weightKg: true,
        performanceBenchmarks: true,
        throwsTyping: {
          select: {
            adaptationGroup: true,
            transferType: true,
            selfFeelingAccuracy: true,
            recoveryProfile: true,
            recommendedMethod: true,
            estimatedSessionsToForm: true,
          },
        },
      },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const { id } = await params;

    // Load config with its training program and phases
    const config = await prisma.selfProgramConfig.findUnique({
      where: { id },
      include: {
        trainingProgram: {
          include: {
            phases: {
              orderBy: { phaseOrder: "desc" },
              take: 1, // most recent phase
            },
          },
        },
      },
    });

    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    // Ownership check
    if (config.athleteProfileId !== athlete.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!config.isActive) {
      return NextResponse.json(
        { error: "Config has been deactivated." },
        { status: 400 },
      );
    }

    if (!config.trainingProgram) {
      return NextResponse.json(
        { error: "No training program linked. Generate the initial program first." },
        { status: 400 },
      );
    }

    const program = config.trainingProgram;
    const latestPhase = program.phases[0]; // Most recent by phaseOrder DESC

    if (!latestPhase) {
      return NextResponse.json(
        { error: "No existing phases found in the program." },
        { status: 400 },
      );
    }

    // Determine next phase type
    const nextPhaseType = determineNextPhase(
      latestPhase.phase,
      config.competitionDates,
    );
    const nextPhaseOrder = latestPhase.phaseOrder + 1;
    const nextStartWeek = latestPhase.endWeek + 1;
    const phaseDuration = DEFAULT_PHASE_DURATION[nextPhaseType];

    // Resolve typing (same logic as generate route)
    let existingTyping: TypingSnapshot | null = null;

    if (athlete.throwsTyping) {
      const t = athlete.throwsTyping;
      if (t.adaptationGroup != null && t.recommendedMethod != null) {
        existingTyping = {
          adaptationGroup: t.adaptationGroup,
          sessionsToForm: t.estimatedSessionsToForm ?? 24,
          recommendedMethod: t.recommendedMethod,
          transferType: t.transferType ?? undefined,
          selfFeelingAccuracy: t.selfFeelingAccuracy ?? undefined,
          recoveryProfile: t.recoveryProfile ?? undefined,
        };
      }
    }

    if (!existingTyping && session.role === "COACH") {
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId: session.userId },
        select: {
          coachTyping: {
            select: {
              adaptationGroup: true,
              transferType: true,
              selfFeelingAccuracy: true,
              recoveryProfile: true,
              recommendedMethod: true,
            },
          },
        },
      });
      if (coachProfile?.coachTyping) {
        const ct = coachProfile.coachTyping;
        if (ct.adaptationGroup != null && ct.recommendedMethod != null) {
          existingTyping = {
            adaptationGroup: ct.adaptationGroup,
            sessionsToForm: 24,
            recommendedMethod: ct.recommendedMethod,
            transferType: ct.transferType ?? undefined,
            selfFeelingAccuracy: ct.selfFeelingAccuracy ?? undefined,
            recoveryProfile: ct.recoveryProfile ?? undefined,
          };
        }
      }
    }

    // Build ProgramConfig with updated start/target dates
    const programConfig = buildProgramConfig(
      {
        ...config,
        // Shift startDate to end of current phase
        startDate: new Date(
          new Date(programConfig_startDateFallback(program.startDate)).getTime() +
            (latestPhase.endWeek - 1) * 7 * 24 * 60 * 60 * 1000,
        ),
      },
      existingTyping,
      athlete.performanceBenchmarks ?? null,
      athlete.weightKg,
    );

    // Generate a single phase
    const phaseGenConfig: PhaseGenConfig = {
      phase: nextPhaseType,
      phaseOrder: nextPhaseOrder,
      startWeek: nextStartWeek,
      durationWeeks: phaseDuration,
      programConfig,
    };

    const generatedPhase = generatePhase(phaseGenConfig);

    // Persist the new phase and its sessions
    await prisma.$transaction(async (tx) => {
      const phase = await tx.programPhase.create({
        data: {
          programId: program.id,
          phase: generatedPhase.phase,
          phaseOrder: generatedPhase.phaseOrder,
          startWeek: generatedPhase.startWeek,
          endWeek: generatedPhase.endWeek,
          durationWeeks: generatedPhase.durationWeeks,
          throwsPerWeekTarget: generatedPhase.throwsPerWeekTarget,
          strengthDaysTarget: generatedPhase.strengthDaysTarget,
          cePercent: generatedPhase.cePercent,
          sdPercent: generatedPhase.sdPercent,
          spPercent: generatedPhase.spPercent,
          gpPercent: generatedPhase.gpPercent,
          lightPercent: generatedPhase.lightPercent,
          compPercent: generatedPhase.compPercent,
          heavyPercent: generatedPhase.heavyPercent,
          exerciseComplex: JSON.stringify(generatedPhase.exerciseComplex),
          status: "PLANNED",
        },
      });

      // Save sessions for this phase
      for (const genWeek of generatedPhase.weeks) {
        for (const genSession of genWeek.sessions) {
          await tx.programSession.create({
            data: {
              programId: program.id,
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
    });

    // Update config rolling state
    await prisma.selfProgramConfig.update({
      where: { id: config.id },
      data: {
        generationCount: { increment: 1 },
        currentPhaseIndex: nextPhaseOrder - 1,
      },
    });

    logger.info("Self-program next phase generated", {
      context: "api/athlete/self-program/generate-next",
      userId: session.userId,
      metadata: {
        configId: config.id,
        programId: program.id,
        phase: nextPhaseType,
        phaseOrder: nextPhaseOrder,
        durationWeeks: phaseDuration,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        phase: nextPhaseType,
        phaseOrder: nextPhaseOrder,
        startWeek: nextStartWeek,
        endWeek: generatedPhase.endWeek,
        durationWeeks: phaseDuration,
        throwsPerWeekTarget: generatedPhase.throwsPerWeekTarget,
        strengthDaysTarget: generatedPhase.strengthDaysTarget,
      },
    });
  } catch (err) {
    logger.error("POST /api/athlete/self-program/[id]/generate-next", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to generate next phase." },
      { status: 500 },
    );
  }
}

/**
 * Parse a program start date string (YYYY-MM-DD) into a Date, falling back to now.
 */
function programConfig_startDateFallback(startDate: string): string {
  return startDate || new Date().toISOString().slice(0, 10);
}
