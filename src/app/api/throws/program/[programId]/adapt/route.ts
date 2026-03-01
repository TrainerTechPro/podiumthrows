import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { canAccessProgram } from "@/lib/authorize";
import { checkAdaptation } from "@/lib/throws/engine";
import type { AdaptationCheckParams } from "@/lib/throws/engine";

interface Params {
  params: Promise<{ programId: string }>;
}

// ── POST /api/throws/program/[programId]/adapt ───────────────────────
// Run adaptation analysis on the current program. Gathers recent marks,
// readiness, and soreness data, then applies the Bondarchuk decision tree.
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

    // Fetch program with adaptation state
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

    // Gather recent throw results (last 15 competition-implement marks)
    const recentThrows = await prisma.programThrowResult.findMany({
      where: {
        session: { programId },
        distance: { gt: 0 },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { distance: true },
    });

    const recentMarks = recentThrows
      .map((t) => t.distance)
      .filter((d): d is number => d != null)
      .reverse(); // oldest first for slope calc

    // Gather recent session self-reports (readiness + soreness)
    const recentSessions = await prisma.programSession.findMany({
      where: {
        programId,
        status: "COMPLETED",
        selfFeeling: { not: null },
      },
      orderBy: { scheduledDate: "desc" },
      take: 10,
      select: { selfFeeling: true, rpe: true },
    });

    // Map selfFeeling to numeric readiness (GREAT=90, GOOD=75, OK=60, POOR=45, BAD=30)
    const feelingMap: Record<string, number> = {
      GREAT: 90,
      GOOD: 75,
      OK: 60,
      POOR: 45,
      BAD: 30,
    };
    const recentReadinessScores = recentSessions
      .map((s) => feelingMap[s.selfFeeling ?? ""] ?? 60)
      .reverse();

    // Map RPE to soreness estimate (RPE 1-10 → soreness 1-10)
    const recentSorenessScores = recentSessions
      .filter((s) => s.rpe != null)
      .map((s) => Math.min(10, (s.rpe ?? 5)))
      .reverse();

    // Gather recent strength results
    const recentLifts = await prisma.programLiftResult.findMany({
      where: { session: { programId } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { exerciseName: true, weight: true, createdAt: true },
    });

    const strengthResults = recentLifts
      .filter((l) => l.weight != null)
      .map((l) => ({
        exerciseName: l.exerciseName,
        weight: l.weight as number,
        date: l.createdAt.toISOString(),
      }))
      .reverse();

    // Count sessions in current complex
    const completedSessionCount = await prisma.programSession.count({
      where: {
        programId,
        status: "COMPLETED",
      },
    });

    // Build params for the adaptation checker
    const checkParams: AdaptationCheckParams = {
      programId,
      recentMarks,
      sessionsInComplex: completedSessionCount,
      sessionsToForm: program.sessionsToForm ?? 30,
      enteredSportsForm: false, // TODO: track from AdaptationCheckpoint history
      weeksSinceForm: 0,
      recentReadinessScores,
      recentSorenessScores,
      strengthResults: strengthResults.length > 0 ? strengthResults : undefined,
    };

    // Check for previous "in form" assessments
    const lastFormCheckpoint = await prisma.adaptationCheckpoint.findFirst({
      where: {
        programId,
        recommendation: "ROTATE_COMPLEX",
        applied: true,
      },
      orderBy: { checkDate: "desc" },
    });

    if (lastFormCheckpoint) {
      const checkDateMs = new Date(lastFormCheckpoint.checkDate).getTime();
      const weeksSinceRotation = Math.floor(
        (Date.now() - checkDateMs) / (7 * 24 * 60 * 60 * 1000),
      );
      // If last rotation was recent, consider form entered
      if (weeksSinceRotation < 6) {
        checkParams.enteredSportsForm = true;
        checkParams.weeksSinceForm = weeksSinceRotation;
      }
    }

    // Run the adaptation engine
    const assessment = checkAdaptation(checkParams);

    // Save checkpoint
    const checkpoint = await prisma.adaptationCheckpoint.create({
      data: {
        programId,
        checkDate: new Date().toISOString().split("T")[0],
        weekNumber: program.currentWeekNumber,
        complexNumber: program.currentComplexNum ?? 1,
        recentMarks: JSON.stringify(recentMarks),
        markTrend: assessment.markTrend,
        averageMark: assessment.averageMark,
        peakMark: assessment.peakMark,
        markSlope: assessment.markSlope,
        avgReadiness: assessment.avgReadiness,
        avgSoreness: assessment.avgSoreness,
        recommendation: assessment.recommendation,
        reasoning: assessment.reasoning,
        applied: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        assessment,
        checkpointId: checkpoint.id,
      },
    });
  } catch (error) {
    logger.error("Adaptation check error", {
      context: "throws/program/adapt",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to run adaptation check" },
      { status: 500 },
    );
  }
}
