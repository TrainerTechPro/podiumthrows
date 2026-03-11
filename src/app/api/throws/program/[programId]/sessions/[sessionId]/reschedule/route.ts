import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { canAccessProgram } from "@/lib/authorize";

interface Params {
  params: Promise<{ programId: string; sessionId: string }>;
}

/**
 * PATCH /api/throws/program/[programId]/sessions/[sessionId]/reschedule
 * Moves a session to a different day (and optionally week).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { programId, sessionId } = await params;

    const allowed = await canAccessProgram(
      user.userId,
      user.role as "COACH" | "ATHLETE",
      programId,
    );
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 },
      );
    }

    let body: { dayOfWeek?: number; weekNumber?: number };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { dayOfWeek, weekNumber } = body;

    if (dayOfWeek !== undefined && (dayOfWeek < 1 || dayOfWeek > 7 || !Number.isInteger(dayOfWeek))) {
      return NextResponse.json(
        { success: false, error: "dayOfWeek must be 1-7 (Mon-Sun)" },
        { status: 400 },
      );
    }

    // Verify session belongs to program
    const session = await prisma.programSession.findFirst({
      where: { id: sessionId, programId },
      select: { id: true, status: true, weekNumber: true, dayOfWeek: true },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 },
      );
    }

    if (session.status === "COMPLETED") {
      return NextResponse.json(
        { success: false, error: "Cannot reschedule a completed session" },
        { status: 400 },
      );
    }

    // Validate weekNumber if provided
    if (weekNumber !== undefined) {
      if (!Number.isInteger(weekNumber) || weekNumber < 1) {
        return NextResponse.json(
          { success: false, error: "Invalid week number" },
          { status: 400 },
        );
      }
      const maxWeek = await prisma.programPhase.aggregate({
        where: { programId },
        _max: { endWeek: true },
      });
      if (weekNumber > (maxWeek._max.endWeek ?? 1)) {
        return NextResponse.json(
          { success: false, error: "Week number exceeds program duration" },
          { status: 400 },
        );
      }
    }

    const updateData: { dayOfWeek?: number; weekNumber?: number } = {};
    if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek;
    if (weekNumber !== undefined) updateData.weekNumber = weekNumber;

    const updated = await prisma.programSession.update({
      where: { id: sessionId },
      data: updateData,
      select: {
        id: true,
        weekNumber: true,
        dayOfWeek: true,
        dayType: true,
        sessionType: true,
        focusLabel: true,
        totalThrowsTarget: true,
        estimatedDuration: true,
        status: true,
      },
    });

    logger.info("Session rescheduled", {
      context: "throws/program/sessions/reschedule",
      userId: user.userId,
      metadata: {
        sessionId,
        from: { weekNumber: session.weekNumber, dayOfWeek: session.dayOfWeek },
        to: { weekNumber: updated.weekNumber, dayOfWeek: updated.dayOfWeek },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error("Reschedule session error", {
      context: "throws/program/sessions/reschedule",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to reschedule session" },
      { status: 500 },
    );
  }
}
