import prisma from "@/lib/prisma";
import { getAthleteTimezone, getLocalDate, combineLocalDateTime } from "@/lib/dates";
import { logger } from "@/lib/logger";

/**
 * Updates AthleteProfile.currentStreak / longestStreak after a session
 * completion. Call this AFTER the source-table mutation has committed, so the
 * today-count includes the fresh row.
 *
 * Counts completions across all 3 sources (ThrowsAssignment, TrainingSession,
 * AthleteThrowsSession). Prior to Phase 2 this lived inline in the throws
 * assignment route and only saw assignments — self-logged and training
 * sessions never bumped the streak. See tasks/unified-session-layer.md §DD-3.
 *
 * Same-day idempotency: if the athlete already had another completion today
 * (i.e. today's count > 1), we skip the increment. Pre-Phase-2 this was
 * broken on the assignments route too — two completions on the same day
 * double-incremented. Unification made the bug worse before this guard.
 */
export async function updateStreakForCompletion(
  athleteId: string,
  completedAt: Date
): Promise<void> {
  try {
    const tz = await getAthleteTimezone(athleteId);
    const todayYMD = getLocalDate(tz, completedAt);

    const todayCount = await countCompletionsOn(athleteId, todayYMD, tz);
    if (todayCount > 1) return;

    const yesterdayYMD = subtractOneDay(todayYMD);
    const yesterdayCount = await countCompletionsOn(athleteId, yesterdayYMD, tz);

    const athlete = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { currentStreak: true, longestStreak: true },
    });
    if (!athlete) return;

    const newStreak = yesterdayCount > 0 ? (athlete.currentStreak ?? 0) + 1 : 1;

    await prisma.athleteProfile.update({
      where: { id: athleteId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(athlete.longestStreak ?? 0, newStreak),
      },
    });
  } catch (err) {
    logger.error("updateStreakForCompletion failed", {
      context: "streak",
      userId: athleteId,
      error: err,
    });
  }
}

async function countCompletionsOn(athleteId: string, ymd: string, tz: string): Promise<number> {
  const dayStart = combineLocalDateTime(ymd, "00:00", tz);
  const dayEnd = combineLocalDateTime(ymd, "23:59", tz);

  const [assignments, trainingSessions, selfLogged] = await Promise.all([
    prisma.throwsAssignment.count({
      where: {
        athleteId,
        status: { in: ["COMPLETED", "PARTIAL"] },
        completedAt: { gte: dayStart, lte: dayEnd },
      },
    }),
    prisma.trainingSession.count({
      where: {
        athleteId,
        status: "COMPLETED",
        completedDate: { gte: dayStart, lte: dayEnd },
      },
    }),
    prisma.athleteThrowsSession.count({
      where: { athleteId, date: ymd },
    }),
  ]);

  return assignments + trainingSessions + selfLogged;
}

function subtractOneDay(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
