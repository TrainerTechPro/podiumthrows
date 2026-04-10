import { NextRequest, NextResponse } from "next/server";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string; sessionId: string }> };

const ALLOWED_STATUSES = ["PLANNED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "SKIPPED"];

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const { id: configId, sessionId } = await params;

    // Verify ownership
    const config = await prisma.selfProgramConfig.findUnique({
      where: { id: configId },
      select: { athleteProfileId: true, trainingProgramId: true },
    });
    if (!config || config.athleteProfileId !== athlete.id) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    // Verify session belongs to this program
    const programSession = await prisma.programSession.findUnique({
      where: { id: sessionId },
      select: { id: true, programId: true, status: true },
    });
    if (!programSession || programSession.programId !== config.trainingProgramId) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      status: newStatus,
      scheduledDate,
      actualPrescription,
      modificationNotes,
    } = body as {
      status?: string;
      scheduledDate?: string;
      actualPrescription?: string;
      modificationNotes?: string;
    };

    // Build update payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};

    // Status change
    if (newStatus !== undefined) {
      if (!ALLOWED_STATUSES.includes(newStatus)) {
        return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
      }
      if (programSession.status === "COMPLETED" || programSession.status === "SKIPPED") {
        return NextResponse.json({ success: false, error: "Cannot modify a completed or skipped session" }, { status: 400 });
      }
      data.status = newStatus;
      if (newStatus === "COMPLETED") data.completedAt = new Date();

      // Reset: clean up ThrowsSession when going back to PLANNED
      // Cascade deletes will remove ThrowsBlocks, ThrowsAssignments, and ThrowsBlockLogs
      if (newStatus === "PLANNED" && programSession.status === "IN_PROGRESS") {
        const throwsSession = await prisma.throwsSession.findFirst({
          where: { tags: { contains: `selfProgram:${sessionId}` } },
          select: { id: true },
        });
        if (throwsSession) {
          await prisma.throwsSession.delete({
            where: { id: throwsSession.id },
          });
        }
      }
    }

    // Reschedule
    if (scheduledDate !== undefined) {
      if (programSession.status === "COMPLETED") {
        return NextResponse.json({ success: false, error: "Cannot reschedule a completed session" }, { status: 400 });
      }
      // Validate YYYY-MM-DD format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
        return NextResponse.json({ success: false, error: "scheduledDate must be YYYY-MM-DD" }, { status: 400 });
      }
      const d = new Date(scheduledDate);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ success: false, error: "Invalid date" }, { status: 400 });
      }
      data.scheduledDate = scheduledDate;
    }

    // Modification (pre-workout adjustments)
    if (actualPrescription !== undefined) {
      data.actualPrescription = actualPrescription;
      data.wasModified = true;
    }
    if (modificationNotes !== undefined) {
      data.modificationNotes = modificationNotes;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.programSession.update({
      where: { id: sessionId },
      data,
      select: {
        id: true,
        status: true,
        completedAt: true,
        scheduledDate: true,
        wasModified: true,
        modificationNotes: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    logger.error("PATCH /api/athlete/self-program/[id]/session/[sessionId]", {
      context: "api",
      error: err,
    });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
