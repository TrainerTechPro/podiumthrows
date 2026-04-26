/**
 * Goal progress sync for throws sessions.
 *
 * When an athlete logs a throws session, any best mark at competition weight
 * should automatically update that athlete's matching Goal.currentValue.
 *
 * Business rules:
 *   - Only ACTIVE goals are updated.
 *   - Goal.event must match the drill log's event.
 *   - implementWeight must be within COMP_WEIGHT_EPSILON kg of the athlete's
 *     competition weight (accounts for 16lb → 7.25748kg vs 7.26kg entry drift).
 *   - currentValue is only ever increased, never decreased.
 *   - A goal auto-transitions to COMPLETED when currentValue meets or exceeds
 *     targetValue.
 *   - On every increase, milestone crossings (25/50/75/100) are computed and
 *     persisted to Goal.celebratedMilestones so the same toast doesn't fire
 *     twice.
 *   - Gender "OTHER" is skipped — we don't know which competition weight applies.
 *
 * The function returns the milestone celebrations that fired so the caller
 * can include them in the API response and the client can render toasts /
 * the completion overlay.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";
import { COMPETITION_WEIGHTS } from "@/lib/throws";
import { buildCelebration, type MilestoneCelebration } from "@/lib/goals/milestones";

/** Tolerance for matching implement weight to competition weight (kg). */
const COMP_WEIGHT_EPSILON = 0.02;

/** Any Prisma client, including a transaction client. */
type DbClient = PrismaClient | Prisma.TransactionClient;

/** Drill log subset the sync needs. */
export interface SyncDrillLog {
  implementWeight: number | null;
  bestMark: number | null;
}

export interface SyncGoalsResult {
  updatedCount: number;
  celebrations: MilestoneCelebration[];
}

export async function syncGoalsFromDrillLogs(
  athleteId: string,
  event: string,
  gender: "MALE" | "FEMALE" | "OTHER",
  drillLogs: SyncDrillLog[],
  db: DbClient = prisma
): Promise<SyncGoalsResult> {
  const empty: SyncGoalsResult = { updatedCount: 0, celebrations: [] };

  if (gender !== "MALE" && gender !== "FEMALE") return empty;

  const compWeight = COMPETITION_WEIGHTS[event]?.[gender === "MALE" ? "male" : "female"];
  if (!compWeight) return empty;

  // Find the best mark across all drill logs at competition weight.
  let newBest: number | null = null;
  for (const log of drillLogs) {
    if (log.bestMark == null || log.implementWeight == null) continue;
    if (Math.abs(log.implementWeight - compWeight) > COMP_WEIGHT_EPSILON) continue;
    if (newBest == null || log.bestMark > newBest) newBest = log.bestMark;
  }

  if (newBest == null) return empty;

  const goals = await db.goal.findMany({
    where: { athleteId, event: event as never, status: "ACTIVE" },
    select: {
      id: true,
      title: true,
      unit: true,
      currentValue: true,
      targetValue: true,
      startingValue: true,
      celebratedMilestones: true,
    },
  });

  let updatedCount = 0;
  const celebrations: MilestoneCelebration[] = [];

  for (const goal of goals) {
    if (goal.unit !== "meters") continue;
    if (newBest <= goal.currentValue) continue;

    const celebration = buildCelebration(goal, newBest);
    const shouldComplete = newBest >= goal.targetValue;

    const nextCelebrated = celebration
      ? Array.from(new Set([...goal.celebratedMilestones, ...celebration.thresholds]))
      : goal.celebratedMilestones;

    await db.goal.update({
      where: { id: goal.id },
      data: {
        currentValue: newBest,
        celebratedMilestones: nextCelebrated,
        ...(shouldComplete ? { status: "COMPLETED" as const } : {}),
      },
    });
    updatedCount++;
    if (celebration) celebrations.push(celebration);
  }

  return { updatedCount, celebrations };
}
