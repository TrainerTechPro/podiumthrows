import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ── GET /api/throws/program ──────────────────────────────────────────
// Returns the athlete's active training program with current phase info.
export async function GET() {
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
      select: { id: true },
    });

    if (!athleteProfile) {
      return NextResponse.json(
        { success: false, error: "No athlete profile found" },
        { status: 404 },
      );
    }

    const program = await prisma.trainingProgram.findFirst({
      where: { athleteId: athleteProfile.id, status: "ACTIVE" },
      include: {
        phases: {
          orderBy: { phaseOrder: "asc" },
          select: {
            id: true,
            phase: true,
            phaseOrder: true,
            startWeek: true,
            endWeek: true,
            durationWeeks: true,
            throwsPerWeekTarget: true,
            strengthDaysTarget: true,
            cePercent: true,
            sdPercent: true,
            spPercent: true,
            gpPercent: true,
            status: true,
          },
        },
      },
    });

    if (!program) {
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    // Count completed sessions
    const completedCount = await prisma.programSession.count({
      where: { programId: program.id, status: "COMPLETED" },
    });

    const totalCount = await prisma.programSession.count({
      where: { programId: program.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...program,
        completedSessions: completedCount,
        totalSessions: totalCount,
      },
    });
  } catch (error) {
    logger.error("Get program error", {
      context: "throws/program",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to fetch program" },
      { status: 500 },
    );
  }
}
