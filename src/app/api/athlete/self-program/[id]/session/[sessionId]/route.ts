import { NextRequest, NextResponse } from "next/server";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string; sessionId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const { id: configId, sessionId } = await params;

    // Verify ownership
    const config = await prisma.selfProgramConfig.findUnique({
      where: { id: configId },
      select: { athleteProfileId: true, trainingProgramId: true },
    });
    if (!config || config.athleteProfileId !== athlete.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Verify session belongs to this program
    const programSession = await prisma.programSession.findUnique({
      where: { id: sessionId },
      select: { id: true, programId: true, status: true },
    });
    if (!programSession || programSession.programId !== config.trainingProgramId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { status: newStatus } = body as { status?: string };

    const allowedStatuses = ["PLANNED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "SKIPPED"];
    if (!newStatus || !allowedStatuses.includes(newStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updated = await prisma.programSession.update({
      where: { id: sessionId },
      data: {
        status: newStatus,
        ...(newStatus === "COMPLETED" ? { completedAt: new Date() } : {}),
      },
      select: { id: true, status: true, completedAt: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    logger.error("PATCH /api/athlete/self-program/[id]/session/[sessionId]", {
      context: "api",
      error: err,
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
