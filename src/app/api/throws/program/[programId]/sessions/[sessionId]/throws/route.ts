import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface Params {
  params: Promise<{ programId: string; sessionId: string }>;
}

// ── POST /api/throws/program/[programId]/sessions/[sessionId]/throws ─
// Log throw results for a session.
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

    // Accept single throw or array of throws
    interface ThrowInput {
      throwNumber?: number;
      implement: string;
      distance?: number | null;
      drillType?: string | null;
      notes?: string | null;
    }
    const throws: ThrowInput[] = Array.isArray(body.throws)
      ? body.throws
      : [body];

    // Batch insert all throws and update session status atomically
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.programThrowResult.createMany({
        data: throws.map((t: ThrowInput, i: number) => ({
          sessionId,
          throwNumber: t.throwNumber ?? i + 1,
          implement: t.implement,
          distance: t.distance ?? null,
          drillType: t.drillType ?? null,
          notes: t.notes ?? null,
        })),
      });

      // Update session status to IN_PROGRESS if still PLANNED/SCHEDULED
      await tx.programSession.updateMany({
        where: {
          id: sessionId,
          status: { in: ["PLANNED", "SCHEDULED"] },
        },
        data: { status: "IN_PROGRESS" },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      data: { logged: result.count },
    });
  } catch (error) {
    logger.error("Log throws error", {
      context: "throws/program/session/throws",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to log throws" },
      { status: 500 },
    );
  }
}
