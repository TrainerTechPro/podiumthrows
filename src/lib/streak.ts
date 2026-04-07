/**
 * Throws-based streak computation.
 *
 * Defines streak as "consecutive days on which the athlete logged at least
 * one ThrowLog". Reads the last 100 days of throw dates and counts backward
 * from today until a gap is found. Writes currentStreak, longestStreak, and
 * lastActivityDate back to AthleteProfile.
 *
 * This helper is intentionally **recompute-from-history** rather than
 * increment-based: other writers in the codebase (sessions/complete and
 * readiness) also touch currentStreak with their own definitions, and a
 * recompute is self-healing against their drift. Any discrepancy created
 * by a different writer gets corrected the next time an athlete logs a
 * throw.
 *
 * All errors are swallowed — streak updates are non-critical and must not
 * fail the surrounding request.
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { emitStreakMilestoneIfCrossed } from "@/lib/team-activity";
import { getLocalDate, getAthleteTimezone } from "@/lib/dates";

const LOOKBACK_DAYS = 100;

/**
 * Recomputes the throws-based streak for an athlete from their ThrowLog
 * history and persists the result. Returns the new currentStreak on success,
 * or `null` if the update failed (caller can ignore a null return).
 */
export async function updateThrowsStreak(athleteId: string): Promise<number | null> {
  try {
    const now = new Date();
    const lookback = new Date(now);
    lookback.setDate(lookback.getDate() - LOOKBACK_DAYS);
    lookback.setHours(0, 0, 0, 0);

    // Resolve the athlete's timezone so day boundaries match their local clock
    const timezone = await getAthleteTimezone(athleteId);

    // Pull every throw date in the lookback window
    const throws = await prisma.throwLog.findMany({
      where: {
        athleteId,
        date: { gte: lookback },
      },
      select: { date: true },
    });

    // Collapse to a Set of local-date keys "YYYY-MM-DD"
    const daySet = new Set<string>();
    for (const t of throws) {
      daySet.add(localDayKey(t.date, timezone));
    }

    // Count backward from today
    const streak = countConsecutiveDays(daySet, now, timezone);

    // Read the existing currentStreak + longestStreak. currentStreak is
    // the "previous" value used below for milestone-crossing detection;
    // longestStreak is for updating the record.
    const athlete = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { currentStreak: true, longestStreak: true },
    });
    if (!athlete) return null;
    const previousStreak = athlete.currentStreak;

    await prisma.athleteProfile.update({
      where: { id: athleteId },
      data: {
        currentStreak: streak,
        longestStreak: Math.max(streak, athlete.longestStreak),
        lastActivityDate: streak > 0 ? now : undefined,
      },
    });

    // Fire team-feed streak milestone emission. CROSSING-based — fires
    // only when the new streak passes a STREAK_BADGE threshold that the
    // previous value hadn't reached. Fire-and-forget.
    void emitStreakMilestoneIfCrossed(athleteId, previousStreak, streak).catch(
      () => null
    );

    return streak;
  } catch (err) {
    logger.error("updateThrowsStreak failed", { context: "api", error: err });
    return null;
  }
}

/**
 * Count consecutive days ending at (and including) `endDate` for which
 * a day key exists in the provided set. If today has no activity, the
 * streak is 0. If today and yesterday have activity, the streak is at
 * least 2.
 */
function countConsecutiveDays(daySet: Set<string>, endDate: Date, timezone: string): number {
  let count = 0;
  // Walk backward one calendar day at a time in the athlete's local timezone.
  // We do this by subtracting 24h from a UTC timestamp and re-keying using
  // localDayKey (which converts to the athlete's tz). This handles DST
  // transitions safely because getLocalDate uses Intl.DateTimeFormat.
  let cursor = new Date(endDate);

  // Guard against runaway loops — the lookback window is the hard ceiling
  for (let i = 0; i < LOOKBACK_DAYS + 1; i++) {
    if (daySet.has(localDayKey(cursor, timezone))) {
      count += 1;
      cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
    } else {
      break;
    }
  }
  return count;
}

/** Local-timezone day key "YYYY-MM-DD" for the athlete's own timezone. */
function localDayKey(date: Date, timezone: string): string {
  return getLocalDate(timezone, date);
}
