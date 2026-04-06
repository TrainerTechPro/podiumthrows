/**
 * Team Activity emit helpers.
 *
 * Fire-and-forget inserts into the TeamActivity table from the existing
 * write paths (PR detection, session completion, streak update, goal
 * transitions, coach post). Each emit function:
 *
 *   1. Looks up the athlete's coachId (the "team").
 *   2. Reads the athlete's feedPrivacy preferences and short-circuits
 *      if the relevant event type is opted out.
 *   3. Inserts a TeamActivity row.
 *   4. Swallows errors so a feed insert can never fail the surrounding
 *      request.
 *
 * Metadata shapes are typed per function so callers can't emit a
 * malformed event. Feed readers must still be defensive — stored JSON
 * from older code versions may have slightly different shapes.
 *
 * Streak milestone emission is CROSSING-based: the caller passes both
 * the previous streak and the new streak, and we only emit when the
 * new value crosses a STREAK_BADGE threshold the old value didn't.
 * This prevents spam on athletes who throw daily while already on a
 * 7+ day streak.
 */

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { STREAK_BADGES } from "@/lib/achievements";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type FeedPrivacy = {
  sharePRs: boolean;
  shareSessions: boolean;
  shareStreaks: boolean;
  shareGoals: boolean;
};

export const DEFAULT_FEED_PRIVACY: FeedPrivacy = {
  sharePRs: true,
  shareSessions: true,
  shareStreaks: true,
  shareGoals: true,
};

export type TeamActivityType =
  | "PR"
  | "SESSION"
  | "STREAK_MILESTONE"
  | "GOAL_COMPLETED"
  | "COACH_POST";

/* ─── Privacy parsing ───────────────────────────────────────────────────── */

/** Parse feedPrivacy out of the athlete's notificationPreferences JSON blob. */
export function parseFeedPrivacy(raw: unknown): FeedPrivacy {
  if (!raw || typeof raw !== "object") return DEFAULT_FEED_PRIVACY;
  const r = raw as Record<string, unknown>;
  const f =
    r.feedPrivacy && typeof r.feedPrivacy === "object"
      ? (r.feedPrivacy as Record<string, unknown>)
      : {};
  return {
    sharePRs: f.sharePRs !== false, // default true — only false if explicitly set
    shareSessions: f.shareSessions !== false,
    shareStreaks: f.shareStreaks !== false,
    shareGoals: f.shareGoals !== false,
  };
}

/* ─── Internal helpers ───────────────────────────────────────────────────── */

async function getAthleteContext(
  athleteId: string
): Promise<{ coachId: string; privacy: FeedPrivacy } | null> {
  const athlete = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    select: { coachId: true, notificationPreferences: true },
  });
  if (!athlete) return null;
  return {
    coachId: athlete.coachId,
    privacy: parseFeedPrivacy(athlete.notificationPreferences),
  };
}

async function insertRow(
  coachId: string,
  athleteId: string | null,
  type: TeamActivityType,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.teamActivity.create({
      data: {
        coachId,
        athleteId,
        type,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    logger.error("Failed to insert TeamActivity", {
      context: "team-activity",
      error: err,
      metadata: { type, coachId },
    });
  }
}

/* ─── Emit: PR ───────────────────────────────────────────────────────────── */

export async function emitPR(
  athleteId: string,
  input: {
    event: string;
    implementWeight: number;
    distance: number;
    previousDistance: number | null;
  }
): Promise<void> {
  const ctx = await getAthleteContext(athleteId);
  if (!ctx) return;
  if (!ctx.privacy.sharePRs) return;

  await insertRow(ctx.coachId, athleteId, "PR", {
    event: input.event,
    implementWeight: input.implementWeight,
    distance: input.distance,
    previousDistance: input.previousDistance,
  });
}

/* ─── Emit: Session complete ─────────────────────────────────────────────── */

export async function emitSessionComplete(
  athleteId: string,
  input: {
    throwCount: number;
    bestDistance: number | null;
    sessionId: string;
  }
): Promise<void> {
  const ctx = await getAthleteContext(athleteId);
  if (!ctx) return;
  if (!ctx.privacy.shareSessions) return;

  // Honor shared session info but strip identifying throw counts if
  // the athlete wants session posts WITHOUT numbers. We use the same
  // shareSessions flag as a simple on/off — if they want session posts
  // without counts in a future iteration, we'd split this into a
  // second pref. For v1, opting out of shareSessions hides the row
  // entirely.
  await insertRow(ctx.coachId, athleteId, "SESSION", {
    throwCount: input.throwCount,
    bestDistance: input.bestDistance,
    sessionId: input.sessionId,
  });
}

/* ─── Emit: Streak milestone (crossing-based) ────────────────────────────── */

/**
 * Emit ONLY when the athlete's streak crosses a STREAK_BADGE threshold.
 * previousStreak is the value BEFORE the current update, newStreak is
 * AFTER. A crossing is: some threshold T exists where
 *   previousStreak < T && newStreak >= T.
 * At most one emit per call — the highest crossing. Subsequent crossings
 * on later updates will emit their own rows.
 */
export async function emitStreakMilestoneIfCrossed(
  athleteId: string,
  previousStreak: number,
  newStreak: number
): Promise<void> {
  if (newStreak <= previousStreak) return; // reset or unchanged

  // Find the HIGHEST badge whose threshold was just crossed
  let crossedBadge: (typeof STREAK_BADGES)[number] | null = null;
  for (const badge of STREAK_BADGES) {
    if (previousStreak < badge.days && newStreak >= badge.days) {
      if (!crossedBadge || badge.days > crossedBadge.days) {
        crossedBadge = badge;
      }
    }
  }
  if (!crossedBadge) return;

  const ctx = await getAthleteContext(athleteId);
  if (!ctx) return;
  if (!ctx.privacy.shareStreaks) return;

  await insertRow(ctx.coachId, athleteId, "STREAK_MILESTONE", {
    days: crossedBadge.days,
    badgeKey: crossedBadge.badgeKey,
    title: crossedBadge.title,
    emoji: crossedBadge.emoji,
  });
}

/* ─── Emit: Goal completed ───────────────────────────────────────────────── */

export async function emitGoalCompleted(
  athleteId: string,
  input: {
    goalId: string;
    title: string;
    targetValue: number;
    unit: string;
  }
): Promise<void> {
  const ctx = await getAthleteContext(athleteId);
  if (!ctx) return;
  if (!ctx.privacy.shareGoals) return;

  await insertRow(ctx.coachId, athleteId, "GOAL_COMPLETED", {
    goalId: input.goalId,
    title: input.title,
    targetValue: input.targetValue,
    unit: input.unit,
  });
}

/* ─── Emit: Coach post ───────────────────────────────────────────────────── */

/**
 * Coach posts bypass the privacy check entirely — the coach is the one
 * publishing, not an athlete whose data is being shared. athleteId is
 * null on COACH_POST rows.
 */
export async function emitCoachPost(
  coachId: string,
  input: { body: string }
): Promise<void> {
  await insertRow(coachId, null, "COACH_POST", { body: input.body });
}
