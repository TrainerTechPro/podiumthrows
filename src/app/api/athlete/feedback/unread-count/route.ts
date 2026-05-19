/**
 * GET /api/athlete/feedback/unread-count
 *
 * Returns the count of unread COACH-authored ThrowComments targeting
 * this athlete. Used by the dashboard red dot and the athlete feedback
 * page header badge.
 *
 * Unread = readAt IS NULL AND authorRole = "COACH" AND target points
 * at something this athlete owns.
 *
 * Implemented as a single raw SQL query with subqueries — the Prisma
 * ThrowComment model doesn't declare relation fields for its polymorphic
 * target columns, so nested-relation filters aren't available. Raw SQL
 * lets Postgres execute the subqueries efficiently against the existing
 * indexes on (athleteId) for each target table.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "ThrowComment" tc
      WHERE tc."authorRole" = 'COACH'
        AND tc."readAt" IS NULL
        AND (
          tc."throwLogId" IN (
            SELECT id FROM "ThrowLog" WHERE "athleteId" = ${athlete.id}
          )
          OR tc."trainingSessionId" IN (
            SELECT id FROM "TrainingSession" WHERE "athleteId" = ${athlete.id}
          )
          OR tc."practiceAttemptId" IN (
            SELECT id FROM "PracticeAttempt" WHERE "athleteId" = ${athlete.id}
          )
          OR tc."throwsAssignmentId" IN (
            SELECT id FROM "ThrowsAssignment" WHERE "athleteId" = ${athlete.id}
          )
        )
    `);

    const unread = Number(rows[0]?.count ?? 0);

    return NextResponse.json({ success: true, data: { unread } });
  } catch (err) {
    logger.error("GET /api/athlete/feedback/unread-count", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Couldn’t load unread count." },
      { status: 500 }
    );
  }
}
