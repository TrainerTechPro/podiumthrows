import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

// DELETE /api/throws/practice/[sessionId]/attempts/[attemptId] — remove a logged attempt
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { sessionId: string; attemptId: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Coach access required" }, { status: 403 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
    }

    const session = await prisma.practiceSession.findUnique({
      where: { id: params.sessionId },
    });
    if (!session || session.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const attempt = await prisma.practiceAttempt.findUnique({
      where: { id: params.attemptId },
    });
    if (!attempt || attempt.sessionId !== params.sessionId) {
      return NextResponse.json({ success: false, error: "Attempt not found" }, { status: 404 });
    }

    await prisma.practiceAttempt.delete({ where: { id: params.attemptId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("DELETE /api/throws/practice/[sessionId]/attempts/[attemptId] error", { context: "throws/practice/attempts", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
