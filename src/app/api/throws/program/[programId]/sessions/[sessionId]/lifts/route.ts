import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface Params {
  params: Promise<{ programId: string; sessionId: string }>;
}

// ── POST /api/throws/program/[programId]/sessions/[sessionId]/lifts ──
// Log strength training results for a session.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { programId, sessionId } = await params;
    const body = await req.json();

    // Verify session
    const session = await prisma.programSession.findUnique({
      where: { id: sessionId },
      select: { programId: true },
    });

    if (!session || session.programId !== programId) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 },
      );
    }

    // Verify ownership
    const program = await prisma.trainingProgram.findUnique({
      where: { id: programId },
      select: { athleteId: true },
    });

    const athleteProfile = await prisma.athleteProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });

    if (program?.athleteId !== athleteProfile?.id) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 },
      );
    }

    // Accept single lift or array of lifts
    const lifts = Array.isArray(body.lifts) ? body.lifts : [body];

    const results = [];
    for (const l of lifts) {
      const result = await prisma.programLiftResult.create({
        data: {
          sessionId,
          exerciseName: l.exerciseName,
          sets: l.sets ?? null,
          reps: l.reps ?? null,
          weight: l.weight ?? null,
          rpe: l.rpe ?? null,
          notes: l.notes ?? null,
        },
      });
      results.push(result);
    }

    // Update session status to IN_PROGRESS if still PLANNED/SCHEDULED
    await prisma.programSession.updateMany({
      where: {
        id: sessionId,
        status: { in: ["PLANNED", "SCHEDULED"] },
      },
      data: { status: "IN_PROGRESS" },
    });

    return NextResponse.json({
      success: true,
      data: { logged: results.length, results },
    });
  } catch (error) {
    logger.error("Log lifts error", {
      context: "throws/program/session/lifts",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to log lifts" },
      { status: 500 },
    );
  }
}
