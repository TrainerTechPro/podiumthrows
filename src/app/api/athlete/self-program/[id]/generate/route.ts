/**
 * POST /api/athlete/self-program/[id]/generate
 *
 * First-time generation: converts a finalized SelfProgramConfig into a
 * full Bondarchuk training program (TrainingProgram + phases + sessions).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { canAccessSelfProgram } from "@/lib/authorize";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { buildProgramConfig } from "@/lib/self-program/adapter";
import { generateProgram } from "@/lib/throws/engine";
import { validateGeneratedProgram } from "@/lib/throws/engine/schemas";
import {
  auditGeneratedProgram,
  applyAdjustments,
} from "@/lib/throws/engine/validate-program-output";
import {
  validateImplementSequence,
  validateBlockStructure,
  validateCrossBlockSequence,
} from "@/lib/bondarchuk";
import type { TypingSnapshot } from "@/lib/throws/engine/types";
import type { BondarchukWarning } from "@/lib/bondarchuk";

type RouteContext = { params: Promise<{ id: string }> };

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

    // Load the config
    const config = await prisma.selfProgramConfig.findUnique({
      where: { id },
    });
    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    // Ownership check
    if (config.athleteProfileId !== athlete.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Must not be a draft
    if (config.isDraft) {
      return NextResponse.json(
        { error: "Config is still a draft. Finalize wizard first." },
        { status: 400 },
      );
    }

    // Must be active
    if (!config.isActive) {
      return NextResponse.json(
        { error: "Config has been deactivated." },
        { status: 400 },
      );
    }

    // Check no other active non-draft config exists for this athlete
    const conflicting = await prisma.selfProgramConfig.findFirst({
      where: {
        athleteProfileId: athlete.id,
        isActive: true,
        isDraft: false,
        id: { not: config.id },
      },
      select: { id: true },
    });
    if (conflicting) {
      return NextResponse.json(
        {
          error: "Another active self-program config already exists.",
          conflictingId: conflicting.id,
        },
        { status: 409 },
      );
    }

    // Resolve typing: athlete ThrowsTyping, or coach CoachTyping (training mode), or inline
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

    // If coach in training mode and no athlete typing, try CoachTyping
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
              complexDuration: true,
            },
          },
        },
      });
      if (coachProfile?.coachTyping) {
        const ct = coachProfile.coachTyping;
        if (ct.adaptationGroup != null && ct.recommendedMethod != null) {
          existingTyping = {
            adaptationGroup: ct.adaptationGroup,
            sessionsToForm: 24, // default; CoachTyping uses complexDuration string
            recommendedMethod: ct.recommendedMethod,
            transferType: ct.transferType ?? undefined,
            selfFeelingAccuracy: ct.selfFeelingAccuracy ?? undefined,
            recoveryProfile: ct.recoveryProfile ?? undefined,
          };
        }
      }
    }

    // Build ProgramConfig from wizard answers
    const programConfig = buildProgramConfig(
      config,
      existingTyping,
      athlete.performanceBenchmarks ?? null,
      athlete.weightKg,
    );

    // Run Bondarchuk validators on a synthetic session from the programConfig
    // (Validate implement ordering from availableImplements)
    const bondarchukErrors: BondarchukWarning[] = [];
    if (programConfig.availableImplements.length > 1) {
      // Build a synthetic block for validation
      const syntheticBlock = {
        name: "Throwing Block",
        blockType: "throwing",
        exercises: programConfig.availableImplements
          .sort((a, b) => b.weightKg - a.weightKg) // engine sorts descending
          .map((impl) => ({
            name: `${impl.weightKg}kg ${impl.type}`,
            implementKg: impl.weightKg,
          })),
      };
      const seqResult = validateImplementSequence([syntheticBlock]);
      const structResult = validateBlockStructure([syntheticBlock]);
      const crossResult = validateCrossBlockSequence([syntheticBlock]);

      const allWarnings = [
        ...seqResult.warnings,
        ...structResult.warnings,
        ...crossResult.warnings,
      ];
      const errors = allWarnings.filter((w) => w.severity === "error");
      if (errors.length > 0) {
        bondarchukErrors.push(...errors);
      }
    }

    if (bondarchukErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Bondarchuk validation failed",
          violations: bondarchukErrors.map((w) => ({
            type: w.type,
            message: w.message,
            severity: w.severity,
          })),
        },
        { status: 422 },
      );
    }

    // Generate the full program
    let generated = generateProgram(programConfig);

    // Validate engine output
    const engineValidation = validateGeneratedProgram(generated);
    if (!engineValidation.valid) {
      logger.error("Self-program engine output validation failed", {
        context: "api/athlete/self-program/generate",
        metadata: { errors: engineValidation.errors },
      });
      return NextResponse.json(
        { error: "Program generation produced invalid output" },
        { status: 500 },
      );
    }

    // Safety audit (ACWR, spike detection)
    const audit = auditGeneratedProgram(generated);
    if (!audit.safe) {
      logger.info("Self-program safety audit found violations, applying adjustments", {
        context: "api/athlete/self-program/generate",
        metadata: {
          warnings: audit.warnings,
          adjustmentCount: audit.adjustments.length,
        },
      });
      generated = applyAdjustments(generated, audit.adjustments);
    }

    // Persist to database (follows exact pattern from generate-for-athlete)
    const program = await prisma.$transaction(async (tx) => {
      const prog = await tx.trainingProgram.create({
        data: {
          athleteId: athlete.id,
          source: "ATHLETE_SELF_GENERATED",
          event: config.event,
          gender: config.gender,
          status: "ACTIVE",
          startDate: programConfig.startDate,
          targetDate: programConfig.targetDate,
          goalDistance: config.goalDistance,
          startingPr: config.currentPR,
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

    // Link the program back to the config and finalize
    await prisma.selfProgramConfig.update({
      where: { id: config.id },
      data: {
        trainingProgramId: program.id,
        isDraft: false,
        generationCount: 1,
      },
    });

    logger.info("Self-program generated", {
      context: "api/athlete/self-program/generate",
      userId: session.userId,
      metadata: {
        configId: config.id,
        programId: program.id,
        totalWeeks: generated.totalWeeks,
        totalPhases: generated.summary.totalPhases,
        totalSessions: generated.summary.totalSessions,
        estimatedTotalThrows: generated.summary.estimatedTotalThrows,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          programId: program.id,
          totalWeeks: generated.totalWeeks,
          summary: generated.summary,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error("POST /api/athlete/self-program/[id]/generate", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to generate self-program." },
      { status: 500 },
    );
  }
}
