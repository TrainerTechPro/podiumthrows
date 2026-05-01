import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody } from "@/lib/api-schemas";
import { ThrowRelabelByWeightSchema } from "@/lib/throws-schemas";
import { recomputeAthleteImplementPR } from "@/lib/implements";

/**
 * POST /api/throws/relabel-by-weight
 *
 * The Fix Old Throws workflow's confirm action. For an athlete + a raw
 * implementWeight (kg), assigns every UNASSIGNED ThrowLog within ±tolerance
 * to the chosen catalog row.
 *
 * Scope: only rows where `implementId IS NULL` are touched. Already-assigned
 * rows are left alone — use /api/throws/bulk-reassign with explicit ids for
 * those.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBody(request, ThrowRelabelByWeightSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { athleteId, fromWeightKg, fromTolerance, toImplementId } = parsed;

    if (!(await canAccessAthlete(session.userId, session.role, athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const newImpl = await prisma.implement.findUnique({
      where: { id: toImplementId },
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

    const tolerance = fromTolerance;
    const lo = fromWeightKg - tolerance;
    const hi = fromWeightKg + tolerance;
    const implementWeightUnit = newImpl.primaryUnit === "lb" ? "lbs" : "kg";
    const implementWeightOriginal =
      newImpl.primaryUnit === "lb" ? newImpl.weightLb : newImpl.weightKg;

    const result = await prisma.$transaction(async (tx) => {
      const update = await tx.throwLog.updateMany({
        where: {
          athleteId,
          implementId: null,
          implementWeight: { gte: lo, lte: hi },
        },
        data: {
          implementId: newImpl.id,
          implementWeight: newImpl.weightKg,
          implementWeightUnit,
          implementWeightOriginal,
          lastEditedById: session.userId,
          lastEditedAt: new Date(),
        },
      });

      // Audit rows for the relabel action — overwrites any prior "ambiguous"/"none" rows.
      const updatedRows = await tx.throwLog.findMany({
        where: { athleteId, implementId: newImpl.id },
        select: {
          id: true,
          implementWeight: true,
          implementWeightUnit: true,
          implementWeightOriginal: true,
        },
      });
      for (const r of updatedRows) {
        await tx.throwLogBackfillAudit.upsert({
          where: { throwLogId: r.id },
          create: {
            throwLogId: r.id,
            beforeWeightKg: r.implementWeight,
            beforeUnit: r.implementWeightUnit,
            beforeOriginal: r.implementWeightOriginal,
            assignedImplementId: newImpl.id,
            deltaKg: +Math.abs(newImpl.weightKg - r.implementWeight).toFixed(4),
            kind: "tolerated",
          },
          update: {
            assignedImplementId: newImpl.id,
            deltaKg: +Math.abs(newImpl.weightKg - r.implementWeight).toFixed(4),
            kind: "tolerated",
            runAt: new Date(),
          },
        });
      }

      await recomputeAthleteImplementPR(tx, athleteId, newImpl.id);

      // Sync isPersonalBest on the affected combo.
      const pr = await tx.athleteImplementPR.findUnique({
        where: { athleteId_implementId: { athleteId, implementId: newImpl.id } },
        select: { bestThrowLogId: true },
      });
      await tx.throwLog.updateMany({
        where: { athleteId, implementId: newImpl.id, isPersonalBest: true },
        data: { isPersonalBest: false },
      });
      if (pr?.bestThrowLogId) {
        await tx.throwLog.update({
          where: { id: pr.bestThrowLogId },
          data: { isPersonalBest: true },
        });
      }

      return { updated: update.count };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error("POST /api/throws/relabel-by-weight", { context: "throws", error });
    return NextResponse.json(
      { success: false, error: "Failed to relabel throws" },
      { status: 500 }
    );
  }
}
