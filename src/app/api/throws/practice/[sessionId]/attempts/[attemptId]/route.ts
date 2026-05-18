import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { recomputeAthleteImplementPR } from "@/lib/implements";

// DELETE /api/throws/practice/[sessionId]/attempts/[attemptId] — remove a logged attempt
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; attemptId: string }> }
) {
  try {
    const { sessionId, attemptId } = await params;
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Coach access required" }, { status: 403 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 404 }
      );
    }

    const session = await prisma.practiceSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const attempt = await prisma.practiceAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, sessionId: true, athleteId: true, implementId: true },
    });
    if (!attempt || attempt.sessionId !== sessionId) {
      return NextResponse.json({ success: false, error: "Attempt not found" }, { status: 404 });
    }

    // Capture catalog identity BEFORE delete so the recompute knows which
    // (athlete, implement) PR to refresh after the row is gone.
    const { athleteId, implementId } = attempt;

    await prisma.$transaction(
      async (tx) => {
        await tx.practiceAttempt.delete({ where: { id: attemptId } });
        if (implementId) {
          await recomputeAthleteImplementPR(tx, athleteId, implementId);
        }
      },
      { timeout: 30_000 }
    );

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    logger.error("DELETE /api/throws/practice/[sessionId]/attempts/[attemptId] error", {
      context: "throws/practice/attempts",
      error: error,
    });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
