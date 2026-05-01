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

    // String-implement parsing for PracticeAttempt + ThrowsBlockLog. Match
    // anything whose parsed kg falls in [lo, hi].
    const KG_PER_LB_LOCAL = 0.45359237;
    const labelToKg = (label: string): number | null => {
      const m = label
        .trim()
        .toLowerCase()
        .match(/^(-?\d+(?:\.\d+)?)\s*(kg|lbs?|g)?$/);
      if (!m) return null;
      const n = parseFloat(m[1]);
      if (!Number.isFinite(n) || n <= 0) return null;
      const u = m[2];
      if (u === "lb" || u === "lbs") return n * KG_PER_LB_LOCAL;
      if (u === "g") return n * 0.001;
      return n;
    };

    const result = await prisma.$transaction(async (tx) => {
      // ThrowLog (kg-typed weight column).
      const throwLogUpdate = await tx.throwLog.updateMany({
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

      // AthleteDrillLog (kg-typed; via session.athleteId).
      const drillUpdate = await tx.athleteDrillLog.updateMany({
        where: {
          session: { athleteId },
          implementId: null,
          implementWeight: { gte: lo, lte: hi },
        },
        data: {
          implementId: newImpl.id,
          implementWeight: newImpl.weightKg,
          implementWeightUnit,
          implementWeightOriginal,
        },
      });

      // PracticeAttempt + ThrowsBlockLog use a String `implement` field —
      // load candidates and match in JS.
      const practiceCandidates = await tx.practiceAttempt.findMany({
        where: { athleteId, implementId: null },
        select: { id: true, implement: true },
      });
      const practiceMatchIds = practiceCandidates
        .filter((p) => {
          const kg = labelToKg(p.implement);
          return kg != null && kg >= lo && kg <= hi;
        })
        .map((p) => p.id);
      const practiceUpdate =
        practiceMatchIds.length > 0
          ? await tx.practiceAttempt.updateMany({
              where: { id: { in: practiceMatchIds } },
              data: { implementId: newImpl.id },
            })
          : { count: 0 };

      const blockCandidates = await tx.throwsBlockLog.findMany({
        where: { assignment: { athleteId }, implementId: null },
        select: { id: true, implement: true },
      });
      const blockMatchIds = blockCandidates
        .filter((b) => {
          const kg = labelToKg(b.implement);
          return kg != null && kg >= lo && kg <= hi;
        })
        .map((b) => b.id);
      const blockUpdate =
        blockMatchIds.length > 0
          ? await tx.throwsBlockLog.updateMany({
              where: { id: { in: blockMatchIds } },
              data: { implementId: newImpl.id },
            })
          : { count: 0 };

      // Audit rows for ThrowLog assignments only (audit table is keyed by
      // throwLogId — drill/practice/block aren't tracked there).
      const updatedThrowLogRows = await tx.throwLog.findMany({
        where: { athleteId, implementId: newImpl.id },
        select: {
          id: true,
          implementWeight: true,
          implementWeightUnit: true,
          implementWeightOriginal: true,
        },
      });
      for (const r of updatedThrowLogRows) {
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
        await tx.throwLog.updateMany({
          where: { id: pr.bestThrowLogId },
          data: { isPersonalBest: true },
        });
      }

      return {
        updated:
          throwLogUpdate.count + drillUpdate.count + practiceUpdate.count + blockUpdate.count,
      };
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
