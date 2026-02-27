import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface Params {
  params: Promise<{ programId: string; sessionId: string }>;
}

// ── POST /api/throws/program/[programId]/sessions/[sessionId]/alternate
// Log an alternate session — what the athlete actually did when deviating
// from the prescribed workout.
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
      select: { programId: true, status: true },
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

    // Validate body
    if (!body.actualPrescription && !body.modificationNotes) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Provide at least actualPrescription (what you did) or modificationNotes (why you changed it)",
        },
        { status: 400 },
      );
    }

    // Update session as modified
    const updated = await prisma.programSession.update({
      where: { id: sessionId },
      data: {
        wasModified: true,
        actualPrescription: body.actualPrescription
          ? JSON.stringify(body.actualPrescription)
          : undefined,
        modificationNotes: body.modificationNotes ?? undefined,
        // Also update status if still planned
        ...(session.status === "PLANNED" || session.status === "SCHEDULED"
          ? { status: "IN_PROGRESS" }
          : {}),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionId: updated.id,
        wasModified: updated.wasModified,
        status: updated.status,
      },
    });
  } catch (error) {
    logger.error("Alternate session error", {
      context: "throws/program/session/alternate",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to log alternate session" },
      { status: 500 },
    );
  }
}
