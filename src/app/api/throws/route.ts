import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody } from "@/lib/api-schemas";
import { ThrowCreateSchema, eventFromImplementType } from "@/lib/throws-schemas";
import { recomputeAthleteImplementPR } from "@/lib/implements";
import { recordThrowInTx } from "@/lib/throws/pr";

/**
 * POST /api/throws — create a single catalog-keyed throw.
 *
 * Body MUST include implementId. weightKg is derived from the catalog row.
 * Auth: athletes can only create on their own profile; coaches via roster.
 *
 * In one transaction:
 *   1. Insert ThrowLog (provisional isPersonalBest=false)
 *   2. Run legacy ThrowsPR check via recordThrowInTx (read-side compat)
 *   3. Recompute the catalog AthleteImplementPR row (new source of truth)
 *   4. Flip ThrowLog.isPersonalBest if it now matches the catalog best
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBody(request, ThrowCreateSchema);
    if (parsed instanceof NextResponse) return parsed;

    const {
      athleteId,
      implementId,
      distance,
      performedAt,
      isCompetition,
      rpe,
      attemptNumber,
      wireLength,
      notes,
      videoUrl,
      competitionId,
      round,
      attemptInRound,
      isFoul,
      foulType,
      isPass,
      sessionId,
    } = parsed;

    if (!(await canAccessAthlete(session.userId, session.role, athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const implement = await prisma.implement.findUnique({
      where: { id: implementId },
      select: {
        id: true,
        throwType: true,
        weightKg: true,
        primaryUnit: true,
        weightLb: true,
        active: true,
      },
    });
    if (!implement || !implement.active) {
      return NextResponse.json(
        { success: false, error: "Implement not found or inactive" },
        { status: 404 }
      );
    }

    const event = eventFromImplementType(implement.throwType);
    const date = performedAt ? new Date(performedAt) : new Date();

    // Carry the catalog primaryUnit forward into the legacy column. Phase F drops it.
    const implementWeightUnit = implement.primaryUnit === "lb" ? "lbs" : "kg";
    const implementWeightOriginal =
      implement.primaryUnit === "lb" ? implement.weightLb : implement.weightKg;

    const result = await prisma.$transaction(async (tx) => {
      const throwLog = await tx.throwLog.create({
        data: {
          athleteId,
          sessionId: sessionId ?? null,
          event,
          implementId: implement.id,
          implementWeight: implement.weightKg,
          implementWeightUnit,
          implementWeightOriginal,
          distance: distance ?? null,
          date,
          isCompetition: isCompetition ?? false,
          isPersonalBest: false,
          rpe: rpe ?? null,
          attemptNumber: attemptNumber ?? null,
          wireLength: wireLength ?? null,
          notes: notes ?? null,
          videoUrl: videoUrl ?? null,
          competitionId: competitionId ?? null,
          round: round ?? null,
          attemptInRound: attemptInRound ?? null,
          isFoul: isFoul ?? false,
          foulType: foulType ?? null,
          isPass: isPass ?? false,
          recordedById: session.userId,
          recordedByRole: session.role,
        },
      });

      // Legacy ThrowsPR write (kept for read-side compat during the migration).
      // Skip if no distance (Quick-Log throws with null distance never set a PR)
      // or if the throw was a foul.
      let prResult: Awaited<ReturnType<typeof recordThrowInTx>> | null = null;
      if (distance != null && distance > 0 && !isFoul) {
        prResult = await recordThrowInTx(tx, {
          athleteId,
          event,
          implementWeightKg: implement.weightKg,
          // Use the catalog shortLabel for legacy PR identity so a kg throw and
          // an lb throw of the same physical weight stay separate in ThrowsPR
          // too. Without this, defaultLabel(7.26) would lump them.
          implementLabel: undefined, // recordThrowInTx defaults to "${kg}kg"; preserved for back-compat
          distance,
          source: isCompetition ? "COMPETITION" : "TRAINING",
          achievedAt: date,
        });
      }

      // New catalog source of truth.
      await recomputeAthleteImplementPR(tx, athleteId, implement.id);

      // Read back the catalog PR to know if THIS throw is the all-time best
      // and flip isPersonalBest on it.
      const catalogPR = await tx.athleteImplementPR.findUnique({
        where: { athleteId_implementId: { athleteId, implementId: implement.id } },
        select: { bestThrowLogId: true },
      });
      const isPersonalBest = catalogPR?.bestThrowLogId === throwLog.id;

      let final = throwLog;
      if (isPersonalBest) {
        final = await tx.throwLog.update({
          where: { id: throwLog.id },
          data: { isPersonalBest: true },
        });
      }

      return { throwLog: final, isPersonalBest, prResult };
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    logger.error("POST /api/throws", { context: "throws", error });
    return NextResponse.json({ success: false, error: "Failed to create throw" }, { status: 500 });
  }
}
