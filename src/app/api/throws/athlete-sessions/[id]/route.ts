import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, AthleteThrowsSessionCreateSchema } from "@/lib/api-schemas";
import { syncGoalsFromDrillLogs } from "@/lib/throws/goal-sync";
import { recordThrow } from "@/lib/throws/pr";
import { EventType } from "@prisma/client";

type SessionPRResult = {
  event: string;
  implement: string;
  distance: number;
  previousBest: number | null;
  previousBestDate: string | null;
};

// GET  /api/throws/athlete-sessions/[id]  — fetch a single session with drill logs
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const session = await prisma.athleteThrowsSession.findUnique({
      where: { id },
      include: { drillLogs: { orderBy: { createdAt: "asc" } } },
    });

    if (!session) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        session.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: session });
  } catch (err) {
    logger.error("athlete-sessions [id] GET error", {
      context: "throws/athlete-sessions/[id]",
      error: err,
    });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

// PUT  /api/throws/athlete-sessions/[id]  — update an existing session + drill logs
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.athleteThrowsSession.findUnique({
      where: { id },
      select: { id: true, athleteId: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        existing.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Reuse the create schema for validation — body shape is identical
    const parsed = await parseBody(request, AthleteThrowsSessionCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { event, date, notes, drillLogs } = parsed;

    // Update session and replace drill logs in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Delete all existing drill logs for this session
      await tx.athleteDrillLog.deleteMany({
        where: { sessionId: id },
      });

      // Update session fields and recreate drill logs
      const session = await tx.athleteThrowsSession.update({
        where: { id },
        data: {
          event: event as EventType,
          date,
          notes: notes ?? null,
          drillLogs: drillLogs?.length
            ? {
                create: (
                  drillLogs as Array<{
                    drillType: string;
                    implementWeight?: number | null;
                    implementWeightUnit?: string | null;
                    implementWeightOriginal?: number | null;
                    wireLength?: string | null;
                    throwCount?: number;
                    bestMark?: number | null;
                    notes?: string | null;
                  }>
                ).map((d) => ({
                  drillType: d.drillType,
                  implementWeight: d.implementWeight ?? null,
                  implementWeightUnit: d.implementWeightUnit ?? "kg",
                  implementWeightOriginal: d.implementWeightOriginal ?? null,
                  wireLength: d.wireLength ?? null,
                  throwCount: d.throwCount ?? 0,
                  bestMark: d.bestMark ?? null,
                  notes: d.notes ?? null,
                })),
              }
            : undefined,
        },
        include: { drillLogs: { orderBy: { createdAt: "asc" } } },
      });

      return session;
    });

    // PR detection across the (now-replaced) drill logs. PUT clears and
    // recreates drill logs so a previously-PR mark may no longer exist —
    // ThrowsPR rows for this combo are *not* recomputed here. The athlete
    // throws/log surface only adds + edits; it never demotes prior PRs.
    // Edit-driven PR demotion is tracked separately under recalculatePRs.
    const prs: SessionPRResult[] = [];
    try {
      for (const dl of updated.drillLogs) {
        if (!dl.implementWeight || !dl.bestMark || dl.bestMark <= 0) continue;
        const implementLabel = dl.implementWeightOriginal
          ? `${dl.implementWeightOriginal}${dl.implementWeightUnit ?? "kg"}`
          : `${parseFloat(dl.implementWeight.toFixed(2))}kg`;
        const result = await recordThrow({
          athleteId: existing.athleteId,
          event,
          implementWeightKg: dl.implementWeight,
          implementLabel,
          distance: dl.bestMark,
          achievedAt: date,
        });
        if (result.isPersonalBest) {
          prs.push({
            event,
            implement: implementLabel,
            distance: dl.bestMark,
            previousBest: result.previousDistance,
            previousBestDate: result.previousAchievedAt,
          });
        }
      }
    } catch (err) {
      logger.error("PR detection after session edit failed", {
        context: "throws/athlete-sessions/[id]",
        error: err,
      });
    }

    // Sync matching active goals from any competition-weight best marks.
    // Best-effort — failures here must not fail the session edit.
    let athleteCoachId: string | null = null;
    try {
      const athlete = await prisma.athleteProfile.findUnique({
        where: { id: existing.athleteId },
        select: { gender: true, coachId: true },
      });
      if (athlete) {
        athleteCoachId = athlete.coachId;
        await syncGoalsFromDrillLogs(existing.athleteId, event, athlete.gender, updated.drillLogs);
      }
    } catch (err) {
      logger.error("goal sync after session edit failed", {
        context: "throws/athlete-sessions/[id]",
        error: err,
      });
    }

    // Invalidate cached data so other widgets update without a page refresh
    revalidateTag(`athlete-${existing.athleteId}`);
    if (athleteCoachId) revalidateTag(`coach-${athleteCoachId}`);

    return NextResponse.json({ success: true, data: updated, prs });
  } catch (err) {
    logger.error("athlete-sessions [id] PUT error", {
      context: "throws/athlete-sessions/[id]",
      error: err,
    });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
