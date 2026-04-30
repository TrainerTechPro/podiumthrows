import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody } from "@/lib/api-schemas";
import { PerformanceTestAttemptPatchSchema } from "@/lib/performance-tests-schemas";
import { recomputeSessionAggregates } from "@/lib/performance-tests";

type RouteCtx = { params: Promise<{ attemptId: string }> };

async function loadAttempt(attemptId: string) {
  return prisma.performanceTestAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      sessionId: true,
      session: { select: { athleteId: true } },
    },
  });
}

/* ── PATCH — update value / isValid / notes ── */
export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  try {
    const { attemptId } = await ctx.params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const attempt = await loadAttempt(attemptId);
    if (!attempt) {
      return NextResponse.json({ success: false, error: "Attempt not found" }, { status: 404 });
    }
    if (!(await canAccessAthlete(session.userId, session.role, attempt.session.athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(request, PerformanceTestAttemptPatchSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { value, isValid, notes } = parsed;

    const updates: Record<string, unknown> = {
      lastEditedById: session.userId,
      lastEditedAt: new Date(),
    };
    if (value !== undefined && value !== null) updates.value = value;
    if (isValid !== undefined && isValid !== null) updates.isValid = isValid;
    if (notes !== undefined) updates.notes = notes;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.performanceTestAttempt.update({
        where: { id: attemptId },
        data: updates,
      });
      const aggregates = await recomputeSessionAggregates(tx, attempt.sessionId);
      return { attempt: updated, aggregates };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error("PATCH performance-tests attempt", { context: "performance-tests", error });
    return NextResponse.json(
      { success: false, error: "Failed to update attempt" },
      { status: 500 }
    );
  }
}

/* ── DELETE — remove an attempt; aggregates recompute ── */
export async function DELETE(_request: NextRequest, ctx: RouteCtx) {
  try {
    const { attemptId } = await ctx.params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const attempt = await loadAttempt(attemptId);
    if (!attempt) {
      // Idempotent — a re-issued delete shouldn't 404.
      return NextResponse.json({ success: true, data: { id: attemptId } });
    }
    if (!(await canAccessAthlete(session.userId, session.role, attempt.session.athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.performanceTestAttempt.delete({ where: { id: attemptId } });
      const aggregates = await recomputeSessionAggregates(tx, attempt.sessionId);
      return { id: attemptId, aggregates };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error("DELETE performance-tests attempt", { context: "performance-tests", error });
    return NextResponse.json(
      { success: false, error: "Failed to delete attempt" },
      { status: 500 }
    );
  }
}
