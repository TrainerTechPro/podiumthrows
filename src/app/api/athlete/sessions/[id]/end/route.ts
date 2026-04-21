import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody } from "@/lib/api-schemas";

/* ─── PATCH — escape hatch for a stuck TrainingSession ────────────────────
   "Complete" requires RPE and triggers the full post-session summary.
   "End" is the no-ceremony version the athlete taps when they walked away
   hours ago and just want the row off their active list. Branches on log
   count: 0 logs → SKIPPED (nothing to record), 1+ logs → COMPLETED (they
   did something). SessionStatus enum has 4 states total: SCHEDULED,
   IN_PROGRESS, COMPLETED, SKIPPED — so "end with logs" pins to COMPLETED.
   See tasks/session-management-v1.md §2.1 + §6.4.
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
      select: { id: true, coachId: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const trainingSession = await prisma.trainingSession.findFirst({
      where: { id, athleteId: athlete.id },
      select: { id: true, status: true },
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

    // Count logs across both tables in parallel. SessionLog covers strength
    // entries, ThrowLog covers individual throws. Either signals "did
    // something" and earns COMPLETED.
    const [sessionLogCount, throwLogCount] = await Promise.all([
      prisma.sessionLog.count({ where: { sessionId: id } }),
      prisma.throwLog.count({ where: { sessionId: id } }),
    ]);
    const hasLogs = sessionLogCount + throwLogCount > 0;
    const nextStatus = hasLogs ? "COMPLETED" : "SKIPPED";

    const updated = await prisma.trainingSession.update({
      where: { id },
      data: {
        status: nextStatus,
        completedDate: hasLogs ? new Date() : null,
      },
      select: { id: true, status: true, completedDate: true },
    });

    revalidateTag(`athlete-${athlete.id}`);
    if (athlete.coachId) revalidateTag(`coach-${athlete.coachId}`);

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    logger.error("PATCH /api/athlete/sessions/[id]/end", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to end session" }, { status: 500 });
  }
}
