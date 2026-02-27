import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface Params {
  params: Promise<{ programId: string }>;
}

// ── GET /api/throws/program/[programId]/today ────────────────────────
// Returns today's session(s) for the program.
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

    // Verify ownership
    const athleteProfile = await prisma.athleteProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });

    if (program.athleteId !== athleteProfile?.id) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 },
      );
    }

    // Today's day of week (1=Mon, 7=Sun)
    const today = new Date();
    const jsDay = today.getDay(); // 0=Sun
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    // Find sessions for today (current week + day of week)
    const sessions = await prisma.programSession.findMany({
      where: {
        programId,
        weekNumber: program.currentWeekNumber,
        dayOfWeek,
      },
      include: {
        throwResults: { orderBy: { throwNumber: "asc" } },
        liftResults: true,
      },
      orderBy: { id: "asc" },
    });

    // Parse JSON prescriptions for each session
    const parsedSessions = sessions.map((s) => ({
      ...s,
      throwsPrescription: safeParseJson(s.throwsPrescription),
      strengthPrescription: safeParseJson(s.strengthPrescription),
      warmupPrescription: safeParseJson(s.warmupPrescription),
    }));

    // Also get the current phase info
    const currentPhase = program.currentPhaseId
      ? await prisma.programPhase.findUnique({
          where: { id: program.currentPhaseId },
          select: {
            phase: true,
            phaseOrder: true,
            durationWeeks: true,
            startWeek: true,
            endWeek: true,
          },
        })
      : null;

    return NextResponse.json({
      success: true,
      data: {
        weekNumber: program.currentWeekNumber,
        dayOfWeek,
        currentPhase,
        sessions: parsedSessions,
      },
    });
  } catch (error) {
    logger.error("Get today's sessions error", {
      context: "throws/program/today",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to fetch today's sessions" },
      { status: 500 },
    );
  }
}

function safeParseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
