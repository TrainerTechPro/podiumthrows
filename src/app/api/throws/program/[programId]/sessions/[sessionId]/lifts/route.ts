import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { parseBody, ProgramLiftsSchema } from "@/lib/api-schemas";

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
    const parsed = await parseBody(req, ProgramLiftsSchema);
    if (parsed instanceof NextResponse) return parsed;

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
      select: { athleteId: true, coachId: true },
    });

    if (!program) {
      return NextResponse.json(
        { success: false, error: "Program not found" },
        { status: 404 },
      );
    }

    if (user.role === "ATHLETE") {
      const athleteProfile = await prisma.athleteProfile.findUnique({
        where: { userId: user.userId },
        select: { id: true },
      });
      if (!athleteProfile || program.athleteId !== athleteProfile.id) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 },
        );
      }
    } else if (user.role === "COACH") {
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId: user.userId },
        select: { id: true },
      });
      if (!coachProfile || program.coachId !== coachProfile.id) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 },
        );
      }
    }

    const results = [];
    for (const l of parsed.lifts) {
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
