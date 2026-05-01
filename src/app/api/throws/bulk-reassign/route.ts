import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody } from "@/lib/api-schemas";
import { ThrowBulkReassignSchema } from "@/lib/throws-schemas";
import { recomputeManyPRs } from "@/lib/implements";

/**
 * POST /api/throws/bulk-reassign
 *
 * Body: { throwIds: string[], newImplementId: string }
 *
 * Used by history page bulk-select and the Phase C Fix Old Throws flow.
 * All requested throwIds must belong to athletes the caller can access —
 * mixed ownership 403s rather than silently filtering.
 *
 * In one transaction:
 *   1. Update each throwLog to the new implementId (+ derived weight columns)
 *   2. Recompute affected (athlete, implementId) PRs once each — old + new
 *   3. Re-sync isPersonalBest flags on all touched athlete/implement combos
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBody(request, ThrowBulkReassignSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { throwIds, newImplementId } = parsed;

    const newImpl = await prisma.implement.findUnique({
      where: { id: newImplementId },
      select: {
        id: true,
        throwType: true,
        weightKg: true,
        weightLb: true,
        primaryUnit: true,
        active: true,
      },
    });
    if (!newImpl || !newImpl.active) {
      return NextResponse.json(
        { success: false, error: "Implement not found or inactive" },
        { status: 404 }
      );
    }

    const rows = await prisma.throwLog.findMany({
      where: { id: { in: throwIds } },
      select: { id: true, athleteId: true, implementId: true },
    });
    if (rows.length === 0) {
      return NextResponse.json({ success: true, data: { updated: 0, recomputed: 0 } });
    }

    // Authorize every distinct athlete touched.
    const athleteIds = Array.from(new Set(rows.map((r) => r.athleteId)));
    for (const athleteId of athleteIds) {
      if (!(await canAccessAthlete(session.userId, session.role, athleteId))) {
        return NextResponse.json(
          { success: false, error: "Forbidden — cannot edit throws for one or more athletes" },
          { status: 403 }
        );
      }
    }

    const implementWeightUnit = newImpl.primaryUnit === "lb" ? "lbs" : "kg";
    const implementWeightOriginal =
      newImpl.primaryUnit === "lb" ? newImpl.weightLb : newImpl.weightKg;

    const result = await prisma.$transaction(async (tx) => {
      // Update all rows in one statement.
      const update = await tx.throwLog.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: {
          implementId: newImpl.id,
          implementWeight: newImpl.weightKg,
          implementWeightUnit,
          implementWeightOriginal,
          lastEditedById: session.userId,
          lastEditedAt: new Date(),
        },
      });

      // Distinct (athlete, implement) pairs to recompute — old AND new.
      const recomputeTargets: { athleteId: string; implementId: string }[] = [];
      for (const r of rows) {
        if (r.implementId && r.implementId !== newImpl.id) {
          recomputeTargets.push({ athleteId: r.athleteId, implementId: r.implementId });
        }
        recomputeTargets.push({ athleteId: r.athleteId, implementId: newImpl.id });
      }
      await recomputeManyPRs(tx, recomputeTargets);

      // Sync isPersonalBest flags on all affected (athlete, implement) combos.
      const seenCombos = new Set<string>();
      for (const target of recomputeTargets) {
        const key = `${target.athleteId}|${target.implementId}`;
        if (seenCombos.has(key)) continue;
        seenCombos.add(key);

        const pr = await tx.athleteImplementPR.findUnique({
          where: {
            athleteId_implementId: target,
          },
          select: { bestThrowLogId: true },
        });
        // Clear any stale PB flags for this combo first.
        await tx.throwLog.updateMany({
          where: {
            athleteId: target.athleteId,
            implementId: target.implementId,
            isPersonalBest: true,
          },
          data: { isPersonalBest: false },
        });
        if (pr?.bestThrowLogId) {
          await tx.throwLog.update({
            where: { id: pr.bestThrowLogId },
            data: { isPersonalBest: true },
          });
        }
      }

      return { updated: update.count, recomputed: seenCombos.size };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error("POST /api/throws/bulk-reassign", { context: "throws", error });
    return NextResponse.json(
      { success: false, error: "Failed to reassign throws" },
      { status: 500 }
    );
  }
}
