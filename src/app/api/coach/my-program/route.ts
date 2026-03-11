import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET /api/coach/my-program
 * Returns the coach's active self-program with phases and session counts.
 */
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

    const program = await prisma.trainingProgram.findFirst({
      where: {
        coachId: coach.id,
        isCoachSelfProgram: true,
        status: "ACTIVE",
      },
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
            status: true,
            _count: { select: { sessions: true } },
          },
        },
      },
    });

    if (!program) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: program,
    });
  } catch (error) {
    logger.error("Get coach self-program error", {
      context: "coach/my-program",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to fetch program" },
      { status: 500 },
    );
  }
}
