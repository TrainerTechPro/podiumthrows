import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface Params {
  params: Promise<{ programId: string; sessionId: string }>;
}

// ── GET /api/throws/program/[programId]/sessions/[sessionId] ─────────
// Returns full session detail with prescriptions and results.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { programId, sessionId } = await params;

    const session = await prisma.programSession.findUnique({
      where: { id: sessionId },
      include: {
        throwResults: { orderBy: { throwNumber: "asc" } },
        liftResults: true,
        bestMarks: { orderBy: { distance: "desc" } },
        phase: {
          select: {
            phase: true,
            phaseOrder: true,
            exerciseComplex: true,
          },
        },
      },
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

    // Parse JSON fields
    const parsed = {
      ...session,
      throwsPrescription: safeParseJson(session.throwsPrescription),
      strengthPrescription: safeParseJson(session.strengthPrescription),
      warmupPrescription: safeParseJson(session.warmupPrescription),
      actualPrescription: safeParseJson(session.actualPrescription),
      phase: session.phase
        ? {
            ...session.phase,
            exerciseComplex: safeParseJson(session.phase.exerciseComplex),
          }
        : null,
    };

    return NextResponse.json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    logger.error("Get session error", {
      context: "throws/program/session",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to fetch session" },
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
