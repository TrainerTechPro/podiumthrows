import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBodyText } from "@/lib/api-schemas";
import { withIdempotency } from "@/lib/idempotency";
import { PerformanceTestAttemptCreateSchema } from "@/lib/performance-tests-schemas";
import {
  isAllTimePR,
  nextAttemptNumber,
  recomputeSessionAggregates,
} from "@/lib/performance-tests";

type RouteCtx = { params: Promise<{ sessionId: string }> };

/* ── POST — append an attempt to a session ── */
export async function POST(request: NextRequest, ctx: RouteCtx) {
  const { sessionId } = await ctx.params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Hydrate parent session and authorize against derived athlete.
  const parent = await prisma.performanceTestSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      athleteId: true,
      testTypeId: true,
      testType: { select: { lowerIsBetter: true } },
    },
  });
  if (!parent) {
    return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
  }
  if (!(await canAccessAthlete(session.userId, session.role, parent.athleteId))) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  return withIdempotency(
    {
      userId: session.userId,
      endpoint: `/api/performance-tests/sessions/${sessionId}/attempts`,
      req: request,
    },
    async (bodyText) => {
      try {
        const parsed = parseBodyText(bodyText, PerformanceTestAttemptCreateSchema);
        if (parsed instanceof NextResponse) return parsed;
        const { value, notes } = parsed;

        // Detect PR BEFORE writing — compares this candidate against every prior
        // session's peakValue, excluding the in-progress session so a later
        // attempt in the same session can still register a session-level peak
        // without falsely claiming an all-time.
        const isPr = await isAllTimePR(prisma, {
          athleteId: parent.athleteId,
          testTypeId: parent.testTypeId,
          candidateValue: value,
          lowerIsBetter: parent.testType.lowerIsBetter,
          excludeSessionId: parent.id,
        });

        const result = await prisma.$transaction(async (tx) => {
          const attemptNumber = await nextAttemptNumber(tx, sessionId);
          const attempt = await tx.performanceTestAttempt.create({
            data: {
              sessionId,
              attemptNumber,
              value,
              isValid: true,
              notes: notes ?? null,
            },
          });
          const aggregates = await recomputeSessionAggregates(tx, sessionId);
          return { attempt, aggregates };
        });

        return NextResponse.json(
          {
            success: true,
            data: { ...result.attempt, aggregates: result.aggregates, isAllTimePR: isPr },
          },
          { status: 201 }
        );
      } catch (error) {
        logger.error("POST performance-tests attempt", { context: "performance-tests", error });
        return NextResponse.json(
          { success: false, error: "Failed to add attempt" },
          { status: 500 }
        );
      }
    }
  );
}
