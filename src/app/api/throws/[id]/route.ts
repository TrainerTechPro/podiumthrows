import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody } from "@/lib/api-schemas";
import { ThrowUpdateSchema } from "@/lib/throws-schemas";
import { recomputeAthleteImplementPR } from "@/lib/implements";

type RouteCtx = { params: Promise<{ id: string }> };

async function loadThrow(id: string) {
  return prisma.throwLog.findUnique({
    where: { id },
    select: {
      id: true,
      athleteId: true,
      implementId: true,
      implementWeight: true,
      event: true,
    },
  });
}

/**
 * PATCH /api/throws/:id
 *
 * Edit a throw — implementId, distance, performedAt, notes, isCompetition, etc.
 * If the implement changes, BOTH old and new (athlete, implement) PRs recompute.
 * If only distance/isCompetition changes, just the current implement recomputes.
 *
 * Auth: athlete-trumps on own profile; coach via roster (canAccessAthlete
 * covers both).
 */
export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const existing = await loadThrow(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Throw not found" }, { status: 404 });
    }
    if (!(await canAccessAthlete(session.userId, session.role, existing.athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(request, ThrowUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;

    // If implementId is changing, validate the new one and pull catalog data.
    let newImplement: {
      id: string;
      weightKg: number;
      primaryUnit: string;
      weightLb: number;
      active: boolean;
    } | null = null;
    if (
      parsed.implementId !== undefined &&
      parsed.implementId !== null &&
      parsed.implementId !== existing.implementId
    ) {
      const impl = await prisma.implement.findUnique({
        where: { id: parsed.implementId },
        select: { id: true, weightKg: true, primaryUnit: true, weightLb: true, active: true },
      });
      if (!impl || !impl.active) {
        return NextResponse.json(
          { success: false, error: "New implement not found or inactive" },
          { status: 404 }
        );
      }
      newImplement = impl;
    }

    const updates: Record<string, unknown> = {
      lastEditedById: session.userId,
      lastEditedAt: new Date(),
    };
    if (parsed.implementId !== undefined) updates.implementId = parsed.implementId;
    if (newImplement) {
      updates.implementWeight = newImplement.weightKg;
      updates.implementWeightUnit = newImplement.primaryUnit === "lb" ? "lbs" : "kg";
      updates.implementWeightOriginal =
        newImplement.primaryUnit === "lb" ? newImplement.weightLb : newImplement.weightKg;
    }
    if (parsed.distance !== undefined) updates.distance = parsed.distance;
    if (parsed.performedAt !== undefined && parsed.performedAt !== null) {
      updates.date = new Date(parsed.performedAt);
    }
    if (parsed.isCompetition !== undefined) updates.isCompetition = parsed.isCompetition;
    if (parsed.rpe !== undefined) updates.rpe = parsed.rpe;
    if (parsed.attemptNumber !== undefined) updates.attemptNumber = parsed.attemptNumber;
    if (parsed.wireLength !== undefined) updates.wireLength = parsed.wireLength;
    if (parsed.notes !== undefined) updates.notes = parsed.notes;
    if (parsed.videoUrl !== undefined) updates.videoUrl = parsed.videoUrl;
    if (parsed.isFoul !== undefined) updates.isFoul = parsed.isFoul;
    if (parsed.foulType !== undefined) updates.foulType = parsed.foulType;
    if (parsed.isPass !== undefined) updates.isPass = parsed.isPass;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.throwLog.update({
        where: { id },
        data: updates,
      });

      // Recompute affected catalog PRs.
      const targets = new Set<string>();
      if (existing.implementId) targets.add(existing.implementId);
      if (row.implementId) targets.add(row.implementId);
      for (const implementId of targets) {
        await recomputeAthleteImplementPR(tx, existing.athleteId, implementId);
      }

      // Sync isPersonalBest on this row against the new catalog state.
      if (row.implementId) {
        const pr = await tx.athleteImplementPR.findUnique({
          where: {
            athleteId_implementId: { athleteId: existing.athleteId, implementId: row.implementId },
          },
          select: { bestThrowLogId: true },
        });
        const shouldBePB = pr?.bestThrowLogId === row.id;
        if (shouldBePB !== row.isPersonalBest) {
          return tx.throwLog.update({
            where: { id: row.id },
            data: { isPersonalBest: shouldBePB },
          });
        }
      } else if (row.isPersonalBest) {
        return tx.throwLog.update({ where: { id: row.id }, data: { isPersonalBest: false } });
      }
      return row;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error("PATCH /api/throws/[id]", { context: "throws", error });
    return NextResponse.json({ success: false, error: "Couldn’t update throw" }, { status: 500 });
  }
}

/**
 * DELETE /api/throws/:id
 *
 * Hard-delete a throw. PR recompute promotes the next-best throw if the
 * deleted row was the bestThrowLogId.
 *
 * Idempotent: a missing row returns success (matches PT pattern).
 */
export async function DELETE(_request: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const existing = await loadThrow(id);
    if (!existing) {
      return NextResponse.json({ success: true, data: { id } });
    }
    if (!(await canAccessAthlete(session.userId, session.role, existing.athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.throwLog.delete({ where: { id } });
      if (existing.implementId) {
        await recomputeAthleteImplementPR(tx, existing.athleteId, existing.implementId);
        // Promote the new bestThrowLogId's row to isPersonalBest=true.
        const pr = await tx.athleteImplementPR.findUnique({
          where: {
            athleteId_implementId: {
              athleteId: existing.athleteId,
              implementId: existing.implementId,
            },
          },
          select: { bestThrowLogId: true },
        });
        if (pr?.bestThrowLogId) {
          await tx.throwLog.update({
            where: { id: pr.bestThrowLogId },
            data: { isPersonalBest: true },
          });
        }
      }
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    logger.error("DELETE /api/throws/[id]", { context: "throws", error });
    return NextResponse.json({ success: false, error: "Couldn’t delete throw" }, { status: 500 });
  }
}
