/**
 * GET /api/coach/my-program/analytics
 *
 * Aggregates all engine analytics for the coach's active self-program.
 * Runs engine functions on completed session data.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  fitLogarithmicGrowth,
  scoreComplexEffectiveness,
  attributeDeficit,
  computeVolumeAdjustment,
  analyzeFeedback,
  generateComplexId,
} from "@/lib/throws/engine";
import { calcAdaptationProgress, calcTransferIndex } from "@/lib/throws/profile-utils";
import { computeTaper } from "@/lib/throws/engine/elite-taper";
import type {
  ComplexHistory,
  FeedbackAnalysis,
  TaperConfig,
  ProgramConfig,
} from "@/lib/throws/engine/types";

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
      include: {
        phases: {
          orderBy: { phaseOrder: "asc" },
          include: {
            sessions: {
              orderBy: [{ weekNumber: "asc" }, { dayOfWeek: "asc" }],
              include: {
                throwResults: {
                  orderBy: { throwNumber: "asc" },
                },
                liftResults: true,
              },
            },
          },
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
    let reasoningCards: unknown[] = [];
    try {
      config = JSON.parse(program.generationConfig || "{}");
      reasoningCards = (config as unknown as Record<string, unknown>).reasoningCards as unknown[] ?? [];
    } catch {
      return NextResponse.json(
        { success: false, error: "Corrupt program configuration" },
        { status: 500 },
      );
    }

    // Validate essential config fields exist (JSON was valid but shape may be wrong)
    if (!config.eventCode || !config.genderCode || !config.competitionPr) {
      return NextResponse.json(
        { success: false, error: "Incomplete program configuration — try regenerating your program" },
        { status: 422 },
      );
    }

    // Collect all marks from throw results
    const allMarks: number[] = [];
    const completedSessions = program.phases.flatMap((p) =>
      p.sessions.filter((s) => s.status === "COMPLETED"),
    );
    let prescribedTotal = 0;
    let actualTotal = 0;
    const rpeValues: number[] = [];
    const weeklyData: Record<
      number,
      { volume: number; bestMark: number; rpe: number; rpeCount: number }
    > = {};

    for (const session of program.phases.flatMap((p) => p.sessions)) {
      const wk = session.weekNumber;
      if (!weeklyData[wk]) {
        weeklyData[wk] = { volume: 0, bestMark: 0, rpe: 0, rpeCount: 0 };
      }
      prescribedTotal += session.totalThrowsTarget;

      if (session.status === "COMPLETED") {
        const throws = session.actualThrows ?? session.totalThrowsTarget;
        actualTotal += throws;
        weeklyData[wk].volume += throws;

        if (session.rpe) {
          rpeValues.push(session.rpe);
          weeklyData[wk].rpe += session.rpe;
          weeklyData[wk].rpeCount += 1;
        }

        for (const result of session.throwResults) {
          if (result.distance && result.distance > 0) {
            allMarks.push(result.distance);
            if (result.distance > weeklyData[wk].bestMark) {
              weeklyData[wk].bestMark = result.distance;
            }
          }
        }
      }
    }

    // Mark prediction
    let markPrediction = null;
    if (allMarks.length >= 3) {
      try {
        markPrediction = fitLogarithmicGrowth(allMarks);
      } catch {
        // Not enough data for log fit
      }
    }

    // Build complex histories by phase
    const complexHistories: ComplexHistory[] = [];
    for (const phase of program.phases) {
      const phaseSessions = phase.sessions.filter(
        (s) => s.status === "COMPLETED",
      );
      if (phaseSessions.length === 0) continue;

      let exercises: Array<{ name: string }> = [];
      try {
        exercises = JSON.parse(phase.exerciseComplex || "[]");
      } catch { /* corrupt data — skip */ }
      const exerciseNames = exercises.map((e) => e.name);
      const marks = phaseSessions.flatMap((s) =>
        s.throwResults.map((r) => r.distance).filter((d): d is number => d !== null && d > 0),
      );
      const rpes = phaseSessions
        .map((s) => s.rpe)
        .filter((r): r is number => r !== null);

      if (marks.length > 0) {
        complexHistories.push({
          complexId: generateComplexId(exerciseNames),
          exercises: exerciseNames,
          sessionsUsed: phaseSessions.length,
          startMark: marks[0],
          endMark: marks[marks.length - 1],
          avgRpe: rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 0,
          avgAdherence: 1,
        });
      }
    }

    // Exercise effectiveness
    let exerciseEffectiveness = null;
    if (complexHistories.length > 0) {
      try {
        exerciseEffectiveness = scoreComplexEffectiveness(complexHistories);
      } catch {
        // insufficient data
      }
    }

    // Deficit attribution
    let deficitAttribution = null;
    if (allMarks.length >= 5 && markPrediction) {
      try {
        const feedback: FeedbackAnalysis = analyzeFeedback({
          marks: allMarks,
          predictedMark: markPrediction?.predictedMark ?? allMarks[allMarks.length - 1],
          prescribedThrows: prescribedTotal,
          actualThrows: actualTotal,
          rpeValues,
          readinessScores: [],
          sorenessScores: [],
        });
        const volumeAdj = computeVolumeAdjustment(feedback);
        deficitAttribution = attributeDeficit(feedback, undefined, exerciseEffectiveness ?? undefined);
        // Include volume adjustment
        (deficitAttribution as unknown as Record<string, unknown>).__volumeAdjustment = volumeAdj;
      } catch {
        // insufficient data
      }
    }

    // Adaptation progress
    const activePhase = program.phases.find(
      (p) => p.id === program.currentPhaseId,
    );
    const sessionsInComplex = activePhase
      ? activePhase.sessions.filter((s) => s.status === "COMPLETED").length
      : 0;
    const adaptationProgress = calcAdaptationProgress(
      sessionsInComplex,
      allMarks.slice(-10),
      false,
    );

    // Volume adherence — scoped to current phase for relevance
    let phasePrescribed = 0;
    let phaseActual = 0;
    if (activePhase) {
      for (const session of activePhase.sessions) {
        phasePrescribed += session.totalThrowsTarget;
        if (session.status === "COMPLETED") {
          phaseActual += session.actualThrows ?? session.totalThrowsTarget;
        }
      }
    }
    // Fall back to all-time if current phase has no data yet
    const adhPrescribed = phasePrescribed > 0 ? phasePrescribed : prescribedTotal;
    const adhActual = phasePrescribed > 0 ? phaseActual : actualTotal;
    const rawRatio = adhPrescribed > 0 ? adhActual / adhPrescribed : 0;
    const volumeAdherence = {
      prescribed: adhPrescribed,
      actual: adhActual,
      ratio: Number.isFinite(rawRatio) ? rawRatio : 0,
    };

    // Transfer index
    let transferIndex = null;
    if (activePhase) {
      let exercises: Array<{ name: string }> = [];
      try {
        exercises = JSON.parse(activePhase.exerciseComplex || "[]");
      } catch { /* corrupt data */ }
      try {
        transferIndex = calcTransferIndex(
          config.eventCode,
          config.genderCode,
          exercises.map((e) => e.name),
          config.competitionPr,
        );
      } catch {
        // missing data
      }
    }

    // Taper preview (only if near competition)
    let taperPreview = null;
    if (program.targetDate) {
      const daysUntilTarget = Math.ceil(
        (new Date(program.targetDate).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysUntilTarget <= 42 && daysUntilTarget > 0) {
        try {
          const taperConfig: TaperConfig = {
            daysUntilMeet: daysUntilTarget,
            adaptationGroup: program.adaptationGroup ?? 2,
            competitionImportance: "A_MEET",
            peakVolume:
              activePhase?.throwsPerWeekTarget ??
              program.phases[0]?.throwsPerWeekTarget ??
              100,
            totalTaperWeeks: Math.min(3, Math.ceil(daysUntilTarget / 7)),
          };
          taperPreview = computeTaper(taperConfig);
        } catch {
          // taper calc failed
        }
      }
    }

    // Build weekly data arrays for charts
    const weekKeys = Object.keys(weeklyData).map(Number);
    const maxWeek = weekKeys.length > 0 ? Math.max(...weekKeys) : 0;
    const weeklyVolume: number[] = [];
    const weeklyMarks: number[] = [];
    const weeklyRpe: number[] = [];
    for (let w = 1; w <= maxWeek; w++) {
      const data = weeklyData[w];
      weeklyVolume.push(data?.volume ?? 0);
      weeklyMarks.push(data?.bestMark ?? 0);
      const rpe = data?.rpeCount ? data.rpe / data.rpeCount : 0;
      weeklyRpe.push(Number.isFinite(rpe) ? rpe : 0);
    }

    return NextResponse.json({
      success: true,
      data: {
        markPrediction,
        exerciseEffectiveness,
        deficitAttribution,
        adaptationProgress,
        volumeAdherence,
        transferIndex,
        taperPreview,
        complexComparison: exerciseEffectiveness,
        reasoningCards,
        weeklyData: {
          volume: weeklyVolume,
          marks: weeklyMarks,
          rpe: weeklyRpe,
        },
        completedSessionCount: completedSessions.length,
        totalMarks: allMarks.length,
      },
    });
  } catch (error) {
    logger.error("Coach my-program analytics error", {
      context: "coach/my-program/analytics",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to load analytics" },
      { status: 500 },
    );
  }
}
