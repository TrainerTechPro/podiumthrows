import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody } from "@/lib/api-schemas";

/* ─── PATCH — escape hatch for a stuck self-program ProgramSession ──────
   Same shape as /api/athlete/sessions/[id]/end but for self-program
   sessions. Log-source is the auto-created ThrowsSession tagged
   `selfProgram:<sessionId>` (see PATCH route in ../route.ts). 0 logs →
   SKIPPED, 1+ logs → COMPLETED.
   ──────────────────────────────────────────────────────────────────── */

const EndSessionSchema = z.object({});

type RouteContext = { params: Promise<{ id: string; sessionId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id: configId, sessionId } = await params;
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBody(req, EndSessionSchema);
    if (parsed instanceof NextResponse) return parsed;

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, coachId: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const config = await prisma.selfProgramConfig.findUnique({
      where: { id: configId },
      select: { athleteProfileId: true, trainingProgramId: true },
    });
    if (!config || config.athleteProfileId !== athlete.id) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const programSession = await prisma.programSession.findUnique({
      where: { id: sessionId },
      select: { id: true, programId: true, status: true },
    });
    if (!programSession || programSession.programId !== config.trainingProgramId) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    if (programSession.status === "COMPLETED" || programSession.status === "SKIPPED") {
      return NextResponse.json(
        { success: false, error: "Session is already finished" },
        { status: 409 }
      );
    }

    // Log source: the ThrowsSession tagged for this self-program session.
    // If a throwsSession exists and its assignment has any logs, it's PARTIAL;
    // else SKIPPED. ThrowsBlockLog count proxies for "did anything happen."
    const taggedThrowsSession = await prisma.throwsSession.findFirst({
      where: { tags: { contains: `selfProgram:${sessionId}` } },
      select: {
        id: true,
        assignments: { select: { id: true } },
      },
    });
    const assignmentIds = taggedThrowsSession?.assignments.map((a) => a.id) ?? [];
    const logCount =
      assignmentIds.length > 0
        ? await prisma.throwsBlockLog.count({
            where: { assignmentId: { in: assignmentIds } },
          })
        : 0;
    const hasLogs = logCount > 0;
    const nextStatus = hasLogs ? "COMPLETED" : "SKIPPED";

    const updated = await prisma.programSession.update({
      where: { id: sessionId },
      data: {
        status: nextStatus,
        completedAt: hasLogs ? new Date() : null,
      },
      select: { id: true, status: true, completedAt: true },
    });

    revalidateTag(`athlete-${athlete.id}`);
    if (athlete.coachId) revalidateTag(`coach-${athlete.coachId}`);

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    logger.error("PATCH /api/athlete/self-program/[id]/session/[sessionId]/end", {
      context: "api",
      error: err,
    });
    return NextResponse.json({ success: false, error: "Couldn’t end session" }, { status: 500 });
  }
}
