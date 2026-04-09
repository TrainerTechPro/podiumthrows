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
 *     targetValue (matches the pattern in /api/athlete/goals/[id]/route.ts).
 *   - Gender "OTHER" is skipped — we don't know which competition weight applies.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";
import { COMPETITION_WEIGHTS } from "@/lib/throws";

/** Tolerance for matching implement weight to competition weight (kg). */
const COMP_WEIGHT_EPSILON = 0.02;

/** Any Prisma client, including a transaction client. */
type DbClient = PrismaClient | Prisma.TransactionClient;

/** Drill log subset the sync needs. */
export interface SyncDrillLog {
  implementWeight: number | null;
  bestMark: number | null;
}

/**
 * Update active goals for this athlete/event based on best marks in the
 * provided drill logs. Returns the number of goals that were updated.
 *
 * This is a best-effort operation — callers should catch errors to avoid
 * bubbling a goal-sync failure up into a session save failure.
 */
export async function syncGoalsFromDrillLogs(
  athleteId: string,
  event: string,
  gender: "MALE" | "FEMALE" | "OTHER",
  drillLogs: SyncDrillLog[],
  db: DbClient = prisma,
): Promise<number> {
  // Only MALE/FEMALE have defined competition weights in the COMPETITION_WEIGHTS
  // table. For OTHER we don't know which class applies — skip the sync and let
  // the athlete update their goal manually.
  if (gender !== "MALE" && gender !== "FEMALE") return 0;

  const compWeight = COMPETITION_WEIGHTS[event]?.[gender === "MALE" ? "male" : "female"];
  if (!compWeight) return 0;

  // Find the best mark across all drill logs at competition weight.
  let newBest: number | null = null;
  for (const log of drillLogs) {
    if (log.bestMark == null || log.implementWeight == null) continue;
    if (Math.abs(log.implementWeight - compWeight) > COMP_WEIGHT_EPSILON) continue;
    if (newBest == null || log.bestMark > newBest) newBest = log.bestMark;
  }

  if (newBest == null) return 0;

  // Load any active goals for this athlete + event.
  const goals = await db.goal.findMany({
    where: { athleteId, event: event as never, status: "ACTIVE" },
    select: { id: true, currentValue: true, targetValue: true, unit: true },
  });

  let updatedCount = 0;
  for (const goal of goals) {
    // Only "meters" goals can be auto-updated from throw distance. Other units
    // (sessions, kg, etc.) are tracked manually and shouldn't be touched.
    if (goal.unit !== "meters") continue;
    if (newBest <= goal.currentValue) continue;

    const shouldComplete = newBest >= goal.targetValue;
    await db.goal.update({
      where: { id: goal.id },
      data: {
        currentValue: newBest,
        ...(shouldComplete ? { status: "COMPLETED" as const } : {}),
      },
    });
    updatedCount++;
  }

  return updatedCount;
}
