/**
 * Coach self-training utilities — PR detection for CoachPR model.
 *
 * Mirrors the athlete `checkAndSetPR()` pattern from `src/lib/throws.ts`
 * but uses the dedicated CoachPR table with upsert semantics.
 */

import prisma from "@/lib/prisma";

/**
 * Check if a distance is a coach PR for the given event + implement combo.
 * If it is, upsert the CoachPR record.
 *
 * Returns `{ isPersonalBest, previousBest? }`.
 */
export async function checkAndSetCoachPR(
  coachId: string,
  event: string,
  implementWeight: number,
  distance: number,
  date: Date = new Date(),
  sessionId?: string,
  drillType?: string,
  implementLabel?: string,
): Promise<{ isPersonalBest: boolean; previousBest?: number }> {
  // Use provided label (e.g. "14lbs") or fall back to rounded kg
  const implement = implementLabel || `${parseFloat(implementWeight.toFixed(2))}kg`;

  const existing = await prisma.coachPR.findUnique({
    where: {
      coachId_event_implement: { coachId, event, implement },
    },
    select: { distance: true },
  });

  const isPersonalBest = !existing || distance > existing.distance;

  if (isPersonalBest) {
    await prisma.coachPR.upsert({
      where: {
        coachId_event_implement: { coachId, event, implement },
      },
      update: {
        distance,
        achievedAt: date,
        sessionId: sessionId ?? null,
        drillType: drillType ?? null,
      },
      create: {
        coachId,
        event,
        implement,
        distance,
        achievedAt: date,
        sessionId: sessionId ?? null,
        drillType: drillType ?? null,
      },
    });
  }

  return {
    isPersonalBest,
    previousBest: existing?.distance,
  };
}

/**
 * Recalculate PRs for a coach after editing/deleting a session.
 * Scans all remaining CoachDrillLog entries for affected (event, implement) pairs.
 * Uses implementWeightOriginal/Unit when available for correct display labels.
 */
export async function recalculateCoachPRs(
  coachId: string,
  event: string,
  affectedImplements: number[],
): Promise<void> {
  for (const weight of affectedImplements) {
    // Find the best remaining drill log for this event + implement
    const best = await prisma.coachDrillLog.findFirst({
      where: {
        session: { coachId, event },
        implementWeight: weight,
        bestMark: { not: null, gt: 0 },
      },
      orderBy: { bestMark: "desc" },
      select: {
        bestMark: true,
        drillType: true,
        sessionId: true,
        implementWeightUnit: true,
        implementWeightOriginal: true,
        session: { select: { date: true } },
      },
    });

    // Build the implement label from original unit if available
    const implement = best?.implementWeightOriginal
      ? `${best.implementWeightOriginal}${best.implementWeightUnit ?? "kg"}`
      : `${parseFloat(weight.toFixed(2))}kg`;

    // Delete ALL existing PRs for this coach/event/weight (any label variant)
    // This cleans up stale labels like "6.35kg" when it should be "14lbs"
    const existingPRs = await prisma.coachPR.findMany({
      where: { coachId, event },
      select: { id: true, implement: true },
    });
    // Find PRs whose implement string represents the same weight (within rounding)
    for (const pr of existingPRs) {
      const prNum = parseFloat(pr.implement);
      if (!isNaN(prNum)) {
        // Convert to kg for comparison: "14lbs" → 6.35, "6.35kg" → 6.35
        const prKg = pr.implement.endsWith("lbs") ? prNum / 2.20462 : prNum;
        if (Math.abs(prKg - weight) < 0.01) {
          // Same implement weight, possibly different label — delete it
          if (pr.implement !== implement) {
            await prisma.coachPR.delete({ where: { id: pr.id } });
          }
        }
      }
    }

    if (best && best.bestMark) {
      await prisma.coachPR.upsert({
        where: {
          coachId_event_implement: { coachId, event, implement },
        },
        update: {
          distance: best.bestMark,
          achievedAt: new Date(best.session.date),
          sessionId: best.sessionId,
          drillType: best.drillType,
        },
        create: {
          coachId,
          event,
          implement,
          distance: best.bestMark,
          achievedAt: new Date(best.session.date),
          sessionId: best.sessionId,
          drillType: best.drillType,
        },
      });
    } else {
      // No remaining data — delete all PR records for this weight
      await prisma.coachPR.deleteMany({
        where: { coachId, event, implement },
      });
    }
  }
}
