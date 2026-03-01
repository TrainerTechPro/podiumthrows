import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface Params {
  params: Promise<{ programId: string }>;
}

// ── GET /api/throws/program/[programId] ──────────────────────────────
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
      include: {
        phases: {
          orderBy: { phaseOrder: "asc" },
          include: {
            sessions: {
              orderBy: [{ weekNumber: "asc" }, { dayOfWeek: "asc" }],
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
                actualThrows: true,
                bestMark: true,
                rpe: true,
              },
            },
          },
        },
      },
    });

    if (!program) {
      return NextResponse.json(
        { success: false, error: "Program not found" },
        { status: 404 },
      );
    }

    // Verify ownership
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

    return NextResponse.json({
      success: true,
      data: program,
    });
  } catch (error) {
    logger.error("Get program detail error", {
      context: "throws/program/[id]",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to fetch program" },
      { status: 500 },
    );
  }
}

// ── PATCH /api/throws/program/[programId] ────────────────────────────
// Update program settings (schedule, status).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { programId } = await params;
    const body = await req.json();

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

    // Only allow updating certain fields
    const allowedUpdates: Record<string, unknown> = {};
    if (body.status !== undefined) allowedUpdates.status = body.status;
    if (body.daysPerWeek !== undefined) allowedUpdates.daysPerWeek = body.daysPerWeek;
    if (body.sessionsPerDay !== undefined) allowedUpdates.sessionsPerDay = body.sessionsPerDay;
    if (body.includeLift !== undefined) allowedUpdates.includeLift = body.includeLift;

    const updated = await prisma.trainingProgram.update({
      where: { id: programId },
      data: allowedUpdates,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    logger.error("Update program error", {
      context: "throws/program/[id]",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to update program" },
      { status: 500 },
    );
  }
}

// ── DELETE /api/throws/program/[programId] ────────────────────────────
// Archive a program (soft delete).
export async function DELETE(req: NextRequest, { params }: Params) {
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

    await prisma.trainingProgram.update({
      where: { id: programId },
      data: { status: "ARCHIVED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Delete program error", {
      context: "throws/program/[id]",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to archive program" },
      { status: 500 },
    );
  }
}
