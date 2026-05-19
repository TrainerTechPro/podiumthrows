/**
 * GET /api/throws/comments/unread-count
 *
 * Returns the count of unread comments (authored by the OTHER party and
 * not yet marked readAt) grouped by targetField + targetId, scoped to the
 * current user's ownership.
 *
 * Response:
 *   { success: true, data: { total, byTarget: { [field]: { [id]: count } } } }
 *
 * ThrowComment stores scalar FKs without relation fields, so we resolve the
 * set of owned target IDs first, then filter comments by `{ in: [...] }`.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { TARGET_FIELDS, type TargetField } from "@/lib/comments/access";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const otherRole = session.role === "COACH" ? "ATHLETE" : "COACH";

    const ownedIds = await resolveOwnedTargetIds(session.userId, session.role);
    if (!ownedIds) {
      return NextResponse.json({
        success: true,
        data: { total: 0, byTarget: emptyByTarget() },
      });
    }

    const orClauses: Array<Record<string, { in: string[] }>> = [];
    for (const field of TARGET_FIELDS) {
      const ids = ownedIds[field];
      if (ids.length > 0) {
        orClauses.push({ [field]: { in: ids } });
      }
    }

    if (orClauses.length === 0) {
      return NextResponse.json({
        success: true,
        data: { total: 0, byTarget: emptyByTarget() },
      });
    }

    type CommentWhere = NonNullable<Parameters<typeof prisma.throwComment.findMany>[0]>["where"];
    const rows = await prisma.throwComment.findMany({
      where: {
        deletedAt: null,
        readAt: null,
        authorRole: otherRole,
        OR: orClauses,
      } as CommentWhere,
      select: {
        throwLogId: true,
        practiceAttemptId: true,
        trainingSessionId: true,
        throwsAssignmentId: true,
        athleteDrillLogId: true,
        videoAnalysisId: true,
      },
    });

    const byTarget = emptyByTarget();
    let total = 0;
    for (const r of rows) {
      for (const field of TARGET_FIELDS) {
        const id = r[field];
        if (id) {
          byTarget[field][id] = (byTarget[field][id] ?? 0) + 1;
          total += 1;
          break;
        }
      }
    }

    return NextResponse.json({ success: true, data: { total, byTarget } });
  } catch (err) {
    logger.error("GET /api/throws/comments/unread-count", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t load unread count" },
      { status: 500 }
    );
  }
}

/**
 * Pull every target ID the user owns across the six surfaces. Runs queries
 * in parallel. Returns null if the user has no profile (no targets).
 */
async function resolveOwnedTargetIds(
  userId: string,
  role: string
): Promise<Record<TargetField, string[]> | null> {
  if (role === "COACH") {
    const coach = await prisma.coachProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!coach) return null;

    const [throwLogs, attempts, sessions, assignments, drills, videos] = await Promise.all([
      prisma.throwLog.findMany({
        where: { athlete: { coachId: coach.id } },
        select: { id: true },
      }),
      prisma.practiceAttempt.findMany({
        where: { session: { coachId: coach.id } },
        select: { id: true },
      }),
      prisma.trainingSession.findMany({
        where: { athlete: { coachId: coach.id } },
        select: { id: true },
      }),
      prisma.throwsAssignment.findMany({
        where: { session: { coachId: coach.id } },
        select: { id: true },
      }),
      prisma.athleteDrillLog.findMany({
        where: { session: { athlete: { coachId: coach.id } } },
        select: { id: true },
      }),
      prisma.videoAnalysis.findMany({
        where: { coachId: coach.id },
        select: { id: true },
      }),
    ]);

    return {
      throwLogId: throwLogs.map((r) => r.id),
      practiceAttemptId: attempts.map((r) => r.id),
      trainingSessionId: sessions.map((r) => r.id),
      throwsAssignmentId: assignments.map((r) => r.id),
      athleteDrillLogId: drills.map((r) => r.id),
      videoAnalysisId: videos.map((r) => r.id),
    };
  }

  if (role === "ATHLETE") {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!athlete) return null;

    const [throwLogs, attempts, sessions, assignments, drills, videos] = await Promise.all([
      prisma.throwLog.findMany({
        where: { athleteId: athlete.id },
        select: { id: true },
      }),
      prisma.practiceAttempt.findMany({
        where: { athleteId: athlete.id },
        select: { id: true },
      }),
      prisma.trainingSession.findMany({
        where: { athleteId: athlete.id },
        select: { id: true },
      }),
      prisma.throwsAssignment.findMany({
        where: { athleteId: athlete.id },
        select: { id: true },
      }),
      prisma.athleteDrillLog.findMany({
        where: { session: { athleteId: athlete.id } },
        select: { id: true },
      }),
      prisma.videoAnalysis.findMany({
        where: { athleteId: athlete.id },
        select: { id: true },
      }),
    ]);

    return {
      throwLogId: throwLogs.map((r) => r.id),
      practiceAttemptId: attempts.map((r) => r.id),
      trainingSessionId: sessions.map((r) => r.id),
      throwsAssignmentId: assignments.map((r) => r.id),
      athleteDrillLogId: drills.map((r) => r.id),
      videoAnalysisId: videos.map((r) => r.id),
    };
  }

  return null;
}

function emptyByTarget(): Record<TargetField, Record<string, number>> {
  return {
    throwLogId: {},
    practiceAttemptId: {},
    trainingSessionId: {},
    throwsAssignmentId: {},
    athleteDrillLogId: {},
    videoAnalysisId: {},
  };
}
