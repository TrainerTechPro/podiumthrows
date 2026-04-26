/**
 * Streak Engine — canonical source of truth for athlete daily-ritual streaks.
 *
 * The streak is a daily ritual: any single qualifying action (logging a throw,
 * a readiness check-in, completing a session) extends it. ONE action per day
 * counts — multiple activities in a day are idempotent.
 *
 * Athletes can freeze their streak once per calendar week (Sunday→Saturday
 * window) for a legitimate rest day. A freeze preserves the streak across one
 * missed day without incrementing it. A second freeze the same week is denied.
 *
 * If a calendar day passes with no qualifying action AND no freeze used, the
 * cron at /api/cron/detect-broken-streaks resets currentStreak to 0 and
 * stamps streakBrokenAt — the dashboard then shows the gentle "Rebuild from
 * day 1 today" card until the athlete does anything.
 *
 * Pure helpers (no DB I/O) live at the top so the day-math is unit-testable.
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAthleteTimezone, getLocalDate, getLocalDayOfWeek } from "@/lib/dates";
import { awardStreakAchievements } from "@/lib/achievements";
import { emitStreakMilestoneIfCrossed } from "@/lib/team-activity";

/* ─── Pure data ──────────────────────────────────────────────────────────── */

/**
 * Milestone thresholds (days). Each one fires a celebration moment + unlocks
 * the matching badge in `STREAK_BADGES`. Listed ascending so `crossedMilestone`
 * returns the LARGEST crossed in the same call — a single +1 extension only
 * crosses one threshold so this is rarely ambiguous, but ascending order is
 * the safe default if it ever matters.
 */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365] as const;
export type StreakMilestone = (typeof STREAK_MILESTONES)[number];

/* ─── Pure helpers (unit-testable, no DB) ────────────────────────────────── */

/**
 * Returns the largest milestone the increment from `prev`→`current` crossed,
 * or null if none was crossed. A milestone is "crossed" when `prev < m` and
 * `current >= m`. Equal-or-decrease never crosses.
 */
export function crossedMilestone(prev: number, current: number): StreakMilestone | null {
  if (current <= prev) return null;
  let crossed: StreakMilestone | null = null;
  for (const m of STREAK_MILESTONES) {
    if (prev < m && current >= m) crossed = m;
  }
  return crossed;
}

export type StreakDecisionInput = {
  /** Local date YYYY-MM-DD of "now" in athlete's timezone. */
  todayLocal: string;
  /** Local date YYYY-MM-DD of the athlete's last streak-bearing activity, or null. */
  lastActivityLocal: string | null;
  /** Local date YYYY-MM-DD of the most recent freeze, or null. */
  lastFreezeLocal: string | null;
  /** The athlete's current streak before this decision. */
  currentStreak: number;
};

export type StreakDecision =
  | { kind: "noop"; reason: "already-counted-today" }
  | { kind: "extend"; from: number; to: number }
  | { kind: "reset"; from: number; to: 1 };

/**
 * Decide what to do when an activity occurs on `todayLocal`. This is the heart
 * of the engine and is intentionally pure: no DB, no clocks, no side effects.
 *
 * Rules:
 *   - If today already counted (last activity OR last freeze == today): noop.
 *   - If yesterday was the last activity OR was covered by a freeze: extend +1.
 *   - Otherwise: the streak is broken — reset to 1 (today still counts as
 *     "day 1 of a new streak" because the action happened).
 */
export function decideOnActivity(input: StreakDecisionInput): StreakDecision {
  const { todayLocal, lastActivityLocal, lastFreezeLocal, currentStreak } = input;
  const yesterdayLocal = subtractOneDayLocal(todayLocal);

  if (lastActivityLocal === todayLocal || lastFreezeLocal === todayLocal) {
    return { kind: "noop", reason: "already-counted-today" };
  }

  const yesterdayCovered =
    lastActivityLocal === yesterdayLocal || lastFreezeLocal === yesterdayLocal;

  if (yesterdayCovered && currentStreak >= 1) {
    return { kind: "extend", from: currentStreak, to: currentStreak + 1 };
  }

  // Either no prior streak (currentStreak 0) OR the gap is >1 day.
  // Today's action becomes the start of a fresh streak.
  return { kind: "reset", from: currentStreak, to: 1 };
}

export type FreezeDecisionInput = {
  todayLocal: string;
  lastActivityLocal: string | null;
  lastFreezeLocal: string | null;
  currentStreak: number;
  freezesAvailable: number;
};

export type FreezeDecision =
  | { kind: "denied"; reason: "no-streak" | "already-frozen-today" | "no-freezes-available" }
  | { kind: "applied" };

export function decideOnFreezeRequest(input: FreezeDecisionInput): FreezeDecision {
  if (input.currentStreak < 1) return { kind: "denied", reason: "no-streak" };
  if (input.lastFreezeLocal === input.todayLocal) {
    return { kind: "denied", reason: "already-frozen-today" };
  }
  if (input.freezesAvailable < 1) {
    return { kind: "denied", reason: "no-freezes-available" };
  }
  return { kind: "applied" };
}

/** YYYY-MM-DD subtraction. Handles month/year rollovers via the Date constructor. */
export function subtractOneDayLocal(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/* ─── DB-bound entry points ──────────────────────────────────────────────── */

export type StreakExtendResult = {
  previousStreak: number;
  currentStreak: number;
  longestStreak: number;
  /** Largest milestone crossed, or null. Drives full-screen celebration. */
  crossedMilestoneDays: StreakMilestone | null;
  /** True if today's activity reset (broke→rebuild) the streak. */
  wasReset: boolean;
};

/**
 * Call this AFTER a qualifying action persists (throw log, readiness check-in,
 * session completion). Idempotent per local day — multiple activities in the
 * same calendar day produce one no-op result.
 *
 * Errors are swallowed and logged. Streak updates are never load-bearing for
 * the surrounding request.
 *
 * Returns null on failure or for the no-op case.
 */
export async function extendStreakForActivity(
  athleteId: string,
  at: Date = new Date()
): Promise<StreakExtendResult | null> {
  try {
    const tz = await getAthleteTimezone(athleteId);
    const todayLocal = getLocalDate(tz, at);

    const athlete = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: {
        currentStreak: true,
        longestStreak: true,
        lastActivityDate: true,
        lastFreezeUsedAt: true,
        streakBrokenAt: true,
      },
    });
    if (!athlete) return null;

    const lastActivityLocal = athlete.lastActivityDate
      ? getLocalDate(tz, athlete.lastActivityDate)
      : null;
    const lastFreezeLocal = athlete.lastFreezeUsedAt
      ? getLocalDate(tz, athlete.lastFreezeUsedAt)
      : null;

    const decision = decideOnActivity({
      todayLocal,
      lastActivityLocal,
      lastFreezeLocal,
      currentStreak: athlete.currentStreak,
    });

    if (decision.kind === "noop") {
      // Even on no-op we still want to clear streakBrokenAt if it's set (the
      // athlete is acting again — the rebuild card should disappear). But if
      // they already cleared it earlier today this is a true no-op.
      if (athlete.streakBrokenAt) {
        await prisma.athleteProfile.update({
          where: { id: athleteId },
          data: { streakBrokenAt: null, lastActivityDate: at },
        });
      }
      return null;
    }

    const newStreak = decision.to;
    const newLongest = Math.max(athlete.longestStreak, newStreak);
    const wasReset = decision.kind === "reset" && decision.from > 0;

    await prisma.athleteProfile.update({
      where: { id: athleteId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastActivityDate: at,
        streakBrokenAt: null, // any activity dismisses the rebuild card
      },
    });

    const milestoneDays = crossedMilestone(decision.from, newStreak);

    // Fire-and-forget side effects: badges + team feed.
    void awardStreakAchievements(athleteId, newStreak).catch((err) =>
      logger.error("awardStreakAchievements failed", { context: "streak", error: err })
    );
    void emitStreakMilestoneIfCrossed(athleteId, decision.from, newStreak).catch(() => null);

    return {
      previousStreak: decision.from,
      currentStreak: newStreak,
      longestStreak: newLongest,
      crossedMilestoneDays: milestoneDays,
      wasReset,
    };
  } catch (err) {
    logger.error("extendStreakForActivity failed", { context: "streak", error: err });
    return null;
  }
}

export type FreezeResult =
  | { ok: true; freezesAvailable: number; freezesResetAt: Date }
  | { ok: false; reason: "no-streak" | "already-frozen-today" | "no-freezes-available" };

/**
 * Apply a streak freeze for "today" in the athlete's local timezone. Decrements
 * the weekly freeze quota and bumps lastActivityDate so the break-detection
 * cron treats today as covered.
 *
 * Idempotent if the athlete has already frozen today (returns "already-frozen-
 * today"). Same week's quota is enforced by the weekly refill cron — this
 * function only checks freezesAvailable > 0.
 */
export async function applyFreezeForToday(
  athleteId: string,
  at: Date = new Date()
): Promise<FreezeResult> {
  const tz = await getAthleteTimezone(athleteId);
  const todayLocal = getLocalDate(tz, at);

  const athlete = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    select: {
      currentStreak: true,
      lastActivityDate: true,
      lastFreezeUsedAt: true,
      freezesAvailable: true,
      freezesResetAt: true,
    },
  });
  if (!athlete) return { ok: false, reason: "no-streak" };

  const lastActivityLocal = athlete.lastActivityDate
    ? getLocalDate(tz, athlete.lastActivityDate)
    : null;
  const lastFreezeLocal = athlete.lastFreezeUsedAt
    ? getLocalDate(tz, athlete.lastFreezeUsedAt)
    : null;

  const decision = decideOnFreezeRequest({
    todayLocal,
    lastActivityLocal,
    lastFreezeLocal,
    currentStreak: athlete.currentStreak,
    freezesAvailable: athlete.freezesAvailable,
  });

  if (decision.kind === "denied") {
    return { ok: false, reason: decision.reason };
  }

  const updated = await prisma.athleteProfile.update({
    where: { id: athleteId },
    data: {
      freezesAvailable: { decrement: 1 },
      lastFreezeUsedAt: at,
      lastActivityDate: at, // keep the break-detection cron at bay
      streakBrokenAt: null,
    },
    select: { freezesAvailable: true, freezesResetAt: true },
  });

  return {
    ok: true,
    freezesAvailable: updated.freezesAvailable,
    freezesResetAt: updated.freezesResetAt,
  };
}

/**
 * Cron entry — refills weekly freeze quotas to 1 every Sunday in each
 * athlete's local timezone. Idempotent: re-running on the same UTC day is
 * safe because we gate on `freezesResetAt < currentWeekStart`.
 */
export async function refillWeeklyFreezes(at: Date = new Date()): Promise<{ refilled: number }> {
  const athletes = await prisma.athleteProfile.findMany({
    select: { id: true, timezone: true, freezesResetAt: true, freezesAvailable: true },
  });

  let refilled = 0;
  for (const a of athletes) {
    const tz = a.timezone ?? "America/New_York";
    const dow = getLocalDayOfWeek(tz, at);
    if (dow !== 0) continue; // refill only on local Sunday

    const todayLocal = getLocalDate(tz, at);
    const resetLocal = getLocalDate(tz, a.freezesResetAt);
    if (resetLocal === todayLocal) continue; // already refilled today

    await prisma.athleteProfile.update({
      where: { id: a.id },
      data: { freezesAvailable: 1, freezesResetAt: at },
    });
    refilled += 1;
  }
  return { refilled };
}

/* ─── Read snapshot for UI ───────────────────────────────────────────────── */

export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date | null;
  freezesAvailable: number;
  freezesResetAt: Date;
  lastFreezeUsedAt: Date | null;
  streakBrokenAt: Date | null;
  lastBrokenStreakDays: number;
  /** True if athlete is mid-rebuild (streak broke since their last activity). */
  isInRebuild: boolean;
  /** True if today's local date is already covered by activity OR freeze. */
  todayCovered: boolean;
  /** Local YYYY-MM-DD for "today" in the athlete's timezone — for client display. */
  todayLocal: string;
};

export async function getStreakState(athleteId: string): Promise<StreakState | null> {
  const athlete = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    select: {
      currentStreak: true,
      longestStreak: true,
      lastActivityDate: true,
      freezesAvailable: true,
      freezesResetAt: true,
      lastFreezeUsedAt: true,
      streakBrokenAt: true,
      lastBrokenStreakDays: true,
    },
  });
  if (!athlete) return null;

  const tz = await getAthleteTimezone(athleteId);
  const now = new Date();
  const todayLocal = getLocalDate(tz, now);
  const lastActivityLocal = athlete.lastActivityDate
    ? getLocalDate(tz, athlete.lastActivityDate)
    : null;
  const lastFreezeLocal = athlete.lastFreezeUsedAt
    ? getLocalDate(tz, athlete.lastFreezeUsedAt)
    : null;

  return {
    ...athlete,
    isInRebuild: athlete.streakBrokenAt !== null && athlete.currentStreak === 0,
    todayCovered: lastActivityLocal === todayLocal || lastFreezeLocal === todayLocal,
    todayLocal,
  };
}
