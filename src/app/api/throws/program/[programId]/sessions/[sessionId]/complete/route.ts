import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface Params {
  params: Promise<{ programId: string; sessionId: string }>;
}

// ── POST /api/throws/program/[programId]/sessions/[sessionId]/complete
// Mark a session as completed with feedback data.
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

    // Verify session exists and belongs to program
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
      select: { athleteId: true, currentWeekNumber: true },
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

    // Update session with completion data
    const updated = await prisma.programSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        actualThrows: body.actualThrows ?? undefined,
        selfFeeling: body.selfFeeling ?? undefined,
        rpe: body.rpe ?? undefined,
        bestMark: body.bestMark ?? undefined,
        sessionNotes: body.sessionNotes ?? undefined,
        // Alternate session fields
        wasModified: body.wasModified ?? undefined,
        actualPrescription: body.actualPrescription
          ? JSON.stringify(body.actualPrescription)
          : undefined,
        modificationNotes: body.modificationNotes ?? undefined,
      },
    });

    // Check if all sessions in the current week are done — auto advance week
    const weekSessions = await prisma.programSession.findMany({
      where: {
        programId,
        weekNumber: updated.weekNumber,
      },
      select: { status: true },
    });

    const allDone = weekSessions.every(
      (s) => s.status === "COMPLETED" || s.status === "SKIPPED",
    );

    if (allDone && program) {
      // Advance to next week
      const nextWeek = (program.currentWeekNumber ?? 1) + 1;

      // Check if next week has sessions
      const nextWeekSessions = await prisma.programSession.count({
        where: { programId, weekNumber: nextWeek },
      });

      if (nextWeekSessions > 0) {
        // Check if we need to advance the phase
        const currentPhase = await prisma.programPhase.findFirst({
          where: { programId, status: "ACTIVE" },
        });

        let newPhaseId = undefined;

        if (currentPhase && nextWeek > currentPhase.endWeek) {
          // Mark current phase as completed
          await prisma.programPhase.update({
            where: { id: currentPhase.id },
            data: { status: "COMPLETED" },
          });

          // Activate next phase
          const nextPhase = await prisma.programPhase.findFirst({
            where: {
              programId,
              phaseOrder: currentPhase.phaseOrder + 1,
            },
          });

          if (nextPhase) {
            await prisma.programPhase.update({
              where: { id: nextPhase.id },
              data: { status: "ACTIVE" },
            });
            newPhaseId = nextPhase.id;
          }
        }

        await prisma.trainingProgram.update({
          where: { id: programId },
          data: {
            currentWeekNumber: nextWeek,
            ...(newPhaseId ? { currentPhaseId: newPhaseId } : {}),
          },
        });
      } else {
        // No more sessions — program complete
        await prisma.trainingProgram.update({
          where: { id: programId },
          data: { status: "COMPLETED" },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: updated.id,
        status: updated.status,
        weekComplete: allDone,
      },
    });
  } catch (error) {
    logger.error("Complete session error", {
      context: "throws/program/session/complete",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to complete session" },
      { status: 500 },
    );
  }
}
