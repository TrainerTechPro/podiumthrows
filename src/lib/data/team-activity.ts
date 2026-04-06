/**
 * Team Activity data helpers — public interface for the feed.
 *
 * This module wraps the lower-level emit helpers in src/lib/team-activity.ts
 * and exposes the three higher-level operations the feed API routes use:
 *
 *   postTeamActivity  — write a new activity row (respects privacy prefs)
 *   getTeamFeed       — paginated read for an athlete's team feed
 *   toggleReaction    — add-or-remove an emoji reaction
 *
 * The underlying schema uses a single `userId` on TeamActivityReaction (not
 * separate athleteId / coachId columns), so toggleReaction accepts a userId
 * directly. Callers pass the authenticated user's User.id.
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { parseFeedPrivacy } from "@/lib/team-activity";
import { Prisma } from "@prisma/client";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type TeamActivityType =
  | "PR"
  | "SESSION"
  | "STREAK_MILESTONE"
  | "GOAL_COMPLETED"
  | "COACH_POST";

export type TeamActivityMetadata = {
  // PR
  event?: string;
  implementWeight?: number;
  distance?: number;
  previousDistance?: number | null;
  // SESSION
  sessionId?: string;
  throwCount?: number;
  bestDistance?: number | null;
  // STREAK_MILESTONE
  days?: number;
  badgeKey?: string;
  title?: string;
  emoji?: string;
  // GOAL_COMPLETED
  goalId?: string;
  goalTitle?: string;
  targetValue?: number;
  unit?: string;
  // COACH_POST
  body?: string;
};

/* ─── postTeamActivity ───────────────────────────────────────────────────── */

/**
 * Insert a TeamActivity row, respecting the athlete's feedPrivacy prefs.
 * Returns the new row id on success, or null if skipped (opted out) or on
 * error. Never throws — designed for fire-and-forget call sites.
 */
export async function postTeamActivity(input: {
  coachId: string;
  type: TeamActivityType;
  athleteId?: string;
  metadata: TeamActivityMetadata;
}): Promise<{ id: string } | null> {
  try {
    // Privacy check for athlete-driven events
    if (input.athleteId && input.type !== "COACH_POST") {
      const profile = await prisma.athleteProfile.findUnique({
        where: { id: input.athleteId },
        select: { notificationPreferences: true },
      });
      if (!profile) return null;

      const privacy = parseFeedPrivacy(profile.notificationPreferences);
      if (input.type === "PR" && !privacy.sharePRs) return null;
      if (input.type === "SESSION" && !privacy.shareSessions) return null;
      if (input.type === "STREAK_MILESTONE" && !privacy.shareStreaks) return null;
      if (input.type === "GOAL_COMPLETED" && !privacy.shareGoals) return null;
    }

    const activity = await prisma.teamActivity.create({
      data: {
        coachId: input.coachId,
        athleteId: input.athleteId ?? null,
        type: input.type,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return activity;
  } catch (err) {
    logger.error("postTeamActivity failed", {
      context: "team-activity",
      error: err,
      metadata: { type: input.type, coachId: input.coachId },
    });
    return null;
  }
}

/* ─── getTeamFeed ────────────────────────────────────────────────────────── */

type FeedAthlete = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

type ReactionCounts = Record<string, number>;

export type FeedItem = {
  id: string;
  type: string;
  metadata: unknown;
  createdAt: string;
  coachId: string;
  athlete: FeedAthlete | null;
  reactions: ReactionCounts;
  myReactions: string[]; // emojis the requesting user has tapped
};

/**
 * Paginated team feed for an athlete, scoped to their coach's roster.
 * Cursor-based: pass the ISO createdAt of the last received row to fetch
 * older rows. Returns up to `limit` items (max 100).
 */
export async function getTeamFeed(
  athleteId: string,
  opts: {
    cursor?: string | null;
    limit?: number;
    requestingUserId: string; // User.id — for myReactions
  }
): Promise<{ items: FeedItem[]; nextCursor: string | null; hasMore: boolean }> {
  const athlete = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    select: { coachId: true },
  });
  if (!athlete) return { items: [], nextCursor: null, hasMore: false };

  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
  const cursor =
    opts.cursor && !isNaN(new Date(opts.cursor).getTime())
      ? new Date(opts.cursor)
      : null;

  const rows = await prisma.teamActivity.findMany({
    where: {
      coachId: athlete.coachId,
      ...(cursor ? { createdAt: { lt: cursor } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      athlete: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
    },
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? pageRows[pageRows.length - 1].createdAt.toISOString()
    : null;

  const activityIds = pageRows.map((r) => r.id);
  let reactionsByActivity = new Map<string, ReactionCounts>();
  let myReactionsByActivity = new Map<string, Set<string>>();

  if (activityIds.length > 0) {
    const allReactions = await prisma.teamActivityReaction.findMany({
      where: { activityId: { in: activityIds } },
      select: { activityId: true, emoji: true, userId: true },
    });

    const reactionMap: Record<string, ReactionCounts> = {};
    const mineMap: Record<string, Set<string>> = {};

    for (const r of allReactions) {
      if (!reactionMap[r.activityId]) reactionMap[r.activityId] = {};
      reactionMap[r.activityId][r.emoji] =
        (reactionMap[r.activityId][r.emoji] ?? 0) + 1;

      if (r.userId === opts.requestingUserId) {
        if (!mineMap[r.activityId]) mineMap[r.activityId] = new Set();
        mineMap[r.activityId].add(r.emoji);
      }
    }

    reactionsByActivity = new Map(Object.entries(reactionMap));
    myReactionsByActivity = new Map(Object.entries(mineMap));
  }

  const items: FeedItem[] = pageRows.map((row) => ({
    id: row.id,
    type: row.type,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    coachId: row.coachId,
    athlete: row.athlete
      ? {
          id: row.athlete.id,
          firstName: row.athlete.firstName,
          lastName: row.athlete.lastName,
          avatarUrl: row.athlete.avatarUrl,
        }
      : null,
    reactions: reactionsByActivity.get(row.id) ?? {},
    myReactions: Array.from(myReactionsByActivity.get(row.id) ?? []),
  }));

  return { items, nextCursor, hasMore };
}

/* ─── toggleReaction ─────────────────────────────────────────────────────── */

const ALLOWED_EMOJIS = ["fire", "lift", "hundred"] as const;
export type ReactionEmoji = (typeof ALLOWED_EMOJIS)[number];

export function isValidEmoji(value: unknown): value is ReactionEmoji {
  return (
    typeof value === "string" &&
    (ALLOWED_EMOJIS as readonly string[]).includes(value)
  );
}

/**
 * Toggle an emoji reaction on a team activity row.
 * If the row already exists for (activityId, userId, emoji) → deletes it.
 * Otherwise → creates it. Returns `{ added: true/false }`.
 *
 * Throws on DB error — callers should catch.
 */
export async function toggleReaction(input: {
  activityId: string;
  emoji: ReactionEmoji;
  userId: string; // User.id (coach or athlete)
}): Promise<{ added: boolean }> {
  const existing = await prisma.teamActivityReaction.findUnique({
    where: {
      activityId_userId_emoji: {
        activityId: input.activityId,
        userId: input.userId,
        emoji: input.emoji,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.teamActivityReaction.delete({ where: { id: existing.id } });
    return { added: false };
  }

  await prisma.teamActivityReaction.create({
    data: {
      activityId: input.activityId,
      userId: input.userId,
      emoji: input.emoji,
    },
  });

  return { added: true };
}
