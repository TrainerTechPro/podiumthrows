import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { canAccessProgram } from "@/lib/authorize";

interface Params {
  params: Promise<{ programId: string }>;
}

// ── GET /api/throws/program/[programId]/week ─────────────────────────
// Returns all sessions for the current week.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { programId } = await params;
    const url = new URL(req.url);
    const weekParam = url.searchParams.get("week");

    const program = await prisma.trainingProgram.findUnique({
      where: { id: programId },
      select: {
        id: true,
        athleteId: true,
        currentWeekNumber: true,
        currentPhaseId: true,
        status: true,
      },
    });

    if (!program || program.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: "No active program found" },
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

    const weekNumber = weekParam
      ? parseInt(weekParam, 10)
      : program.currentWeekNumber;

    const sessions = await prisma.programSession.findMany({
      where: {
        programId,
        weekNumber,
      },
      orderBy: [{ dayOfWeek: "asc" }, { id: "asc" }],
      select: {
        id: true,
        weekNumber: true,
        dayOfWeek: true,
        dayType: true,
        sessionType: true,
        focusLabel: true,
        totalThrowsTarget: true,
        estimatedDuration: true,
        status: true,
        actualThrows: true,
        bestMark: true,
        rpe: true,
        selfFeeling: true,
      },
    });

    // Get phase info for this week
    const phase = await prisma.programPhase.findFirst({
      where: {
        programId,
        startWeek: { lte: weekNumber },
        endWeek: { gte: weekNumber },
      },
      select: {
        phase: true,
        phaseOrder: true,
        startWeek: true,
        endWeek: true,
        throwsPerWeekTarget: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        weekNumber,
        currentWeek: program.currentWeekNumber,
        phase,
        sessions,
      },
    });
  } catch (error) {
    logger.error("Get week sessions error", {
      context: "throws/program/week",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to fetch week sessions" },
      { status: 500 },
    );
  }
}
