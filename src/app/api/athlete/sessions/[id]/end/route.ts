import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody } from "@/lib/api-schemas";
import { onSessionComplete } from "@/lib/sessions/on-session-complete";

/* ─── PATCH — escape hatch for a stuck TrainingSession ────────────────────
   Ends a session the athlete walked away from. Branches on log count: 0 logs
   → SKIPPED, 1+ logs → COMPLETED (the DB enum has no PARTIAL value, so the
   status field pins to COMPLETED; the unified completion handler still
   receives terminalStatus="partial" so coach notifications, streak, and team
   feed all reflect the honest "ended early" semantic).

   Pre-unification, this endpoint was silent on streak + notifications + team
   feed — only throws assignments fired those. See unified-session-layer.md
   §DD-3 + §DD-5 and tasks/session-management-v1.md §2.1 + §6.4.
   ──────────────────────────────────────────────────────────────────── */

const EndSessionSchema = z.object({});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBody(req, EndSessionSchema);
    if (parsed instanceof NextResponse) return parsed;

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, coachId: true, firstName: true, lastName: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const trainingSession = await prisma.trainingSession.findFirst({
      where: { id, athleteId: athlete.id },
      select: {
        id: true,
        status: true,
        plan: { select: { name: true } },
      },
    });
    if (!trainingSession) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    if (trainingSession.status === "COMPLETED" || trainingSession.status === "SKIPPED") {
      return NextResponse.json(
        { success: false, error: "Session is already finished" },
        { status: 409 }
      );
    }

    const [sessionLogCount, throwLogs] = await Promise.all([
      prisma.sessionLog.count({ where: { sessionId: id } }),
      prisma.throwLog.findMany({
        where: { sessionId: id },
        select: { distance: true },
      }),
    ]);
    const hasLogs = sessionLogCount + throwLogs.length > 0;
    const nextStatus = hasLogs ? "COMPLETED" : "SKIPPED";
    const completedAt = new Date();

    const updated = await prisma.trainingSession.update({
      where: { id },
      data: {
        status: nextStatus,
        completedDate: hasLogs ? completedAt : null,
      },
      select: { id: true, status: true, completedDate: true },
    });

    const bestMarkM = throwLogs.reduce(
      (max, t) => (t.distance && t.distance > max ? t.distance : max),
      0
    );
    const athleteName =
      [athlete.firstName, athlete.lastName].filter(Boolean).join(" ") || "Athlete";

    await onSessionComplete({
      athleteId: athlete.id,
      coachId: athlete.coachId ?? null,
      source: "assigned-training",
      sourceId: updated.id,
      terminalStatus: hasLogs ? "partial" : "skipped",
      completedAt,
      sessionTitle: trainingSession.plan?.name ?? "Training Session",
      athleteName,
      metrics: {
        throwCount: throwLogs.length,
        bestMarkM: bestMarkM > 0 ? bestMarkM : null,
        rpe: null,
        selfFeeling: null,
      },
      skipReason: hasLogs ? null : "Ended without any logged activity",
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    logger.error("PATCH /api/athlete/sessions/[id]/end", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to end session" }, { status: 500 });
  }
}
