/**
 * Achievement Engine — Podium Throws
 *
 * All exported functions are idempotent (upsert semantics) and fire-and-forget
 * safe. Callers should wrap in void + .catch(console.error) to avoid blocking
 * API responses.
 */

import { prisma } from "@/lib/prisma";
import { AchievementType, Prisma } from "@prisma/client";

// ─── Badge Definitions ───────────────────────────────────────────────────────

export const STREAK_BADGES = [
  {
    days: 7,
    badgeKey: "streak_7",
    title: "7-Day Streak 🔥",
    description: "Checked in 7 days in a row.",
    emoji: "🔥",
  },
  {
    days: 14,
    badgeKey: "streak_14",
    title: "14-Day Streak 🔥🔥",
    description: "Checked in 14 days in a row.",
    emoji: "🔥🔥",
  },
  {
    days: 30,
    badgeKey: "streak_30",
    title: "30-Day Streak ⚡",
    description: "Checked in every day for a full month.",
    emoji: "⚡",
  },
  {
    days: 60,
    badgeKey: "streak_60",
    title: "60-Day Streak 💎",
    description: "Two months of consistent check-ins.",
    emoji: "💎",
  },
] as const;

export const SESSION_BADGES = [
  {
    count: 10,
    badgeKey: "sessions_10",
    title: "10 Sessions 💪",
    description: "Completed 10 training sessions.",
    emoji: "💪",
  },
  {
    count: 25,
    badgeKey: "sessions_25",
    title: "25 Sessions 🏋️",
    description: "Completed 25 training sessions.",
    emoji: "🏋️",
  },
  {
    count: 50,
    badgeKey: "sessions_50",
    title: "50 Sessions 🥈",
    description: "Completed 50 training sessions.",
    emoji: "🥈",
  },
  {
    count: 100,
    badgeKey: "sessions_100",
    title: "100 Sessions 🥇",
    description: "Century of sessions — elite commitment.",
    emoji: "🥇",
  },
] as const;

export const PR_BADGES = [
  {
    badgeKey: "pr_first",
    title: "First Personal Best 🎯",
    description: "Logged your very first personal best throw.",
    emoji: "🎯",
  },
  {
    badgeKey: "pr_SHOT_PUT",
    title: "Shot Put PR 🏆",
    description: "Set a personal best in the Shot Put.",
    emoji: "🏆",
  },
  {
    badgeKey: "pr_DISCUS",
    title: "Discus PR 🥏",
    description: "Set a personal best in the Discus.",
    emoji: "🥏",
  },
  {
    badgeKey: "pr_HAMMER",
    title: "Hammer PR 🔨",
    description: "Set a personal best in the Hammer.",
    emoji: "🔨",
  },
  {
    badgeKey: "pr_JAVELIN",
    title: "Javelin PR 🎿",
    description: "Set a personal best in the Javelin.",
    emoji: "🎿",
  },
] as const;

export const ALL_BADGE_DEFINITIONS = [
  ...STREAK_BADGES,
  ...SESSION_BADGES,
  ...PR_BADGES,
  {
    badgeKey: "checkin_first",
    title: "First Check-In ✅",
    description: "Completed your first daily readiness check-in.",
    emoji: "✅",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function upsertAchievement({
  athleteId,
  badgeKey,
  type,
  title,
  description,
  metadata,
}: {
  athleteId: string;
  badgeKey: string;
  type: AchievementType;
  title: string;
  description?: string;
  metadata?: Prisma.JsonObject;
}) {
  await prisma.achievement.upsert({
    where: { athleteId_badgeKey: { athleteId, badgeKey } },
    create: {
      athleteId,
      badgeKey,
      type,
      title,
      description,
      metadata: metadata ?? undefined,
      earnedAt: new Date(),
    },
    update: {}, // no-op if already earned
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Award a Personal Best achievement for a specific event.
 * Also awards the "first PR" badge if this is the athlete's first PR overall.
 */
export async function awardPRAchievement(
  athleteId: string,
  event: string
): Promise<void> {
  // Award event-specific PR badge
  const eventBadgeKey = `pr_${event}`;
  const eventBadge = PR_BADGES.find((b) => b.badgeKey === eventBadgeKey);
  if (eventBadge) {
    await upsertAchievement({
      athleteId,
      badgeKey: eventBadgeKey,
      type: "PERSONAL_BEST",
      title: eventBadge.title,
      description: eventBadge.description,
      metadata: { event },
    });
  }

  // Check if this is their very first PR across all events
  const prCount = await prisma.achievement.count({
    where: {
      athleteId,
      type: "PERSONAL_BEST",
      badgeKey: { startsWith: "pr_", not: "pr_first" },
    },
  });
  if (prCount <= 1) {
    // just earned their first event PR
    await upsertAchievement({
      athleteId,
      badgeKey: "pr_first",
      type: "PERSONAL_BEST",
      title: "First Personal Best 🎯",
      description: "Logged your very first personal best throw.",
    });
  }
}

/**
 * Check streak thresholds and award any newly-earned streak badges.
 * Safe to call with any streak value — only awards badges at threshold crossings.
 */
export async function awardStreakAchievements(
  athleteId: string,
  streak: number
): Promise<void> {
  for (const badge of STREAK_BADGES) {
    if (streak >= badge.days) {
      await upsertAchievement({
        athleteId,
        badgeKey: badge.badgeKey,
        type: "STREAK",
        title: badge.title,
        description: badge.description,
        metadata: { streak },
      });
    }
  }
}

/**
 * Count athlete's total completed sessions and award session milestone badges.
 */
export async function awardSessionAchievements(
  athleteId: string
): Promise<void> {
  const sessionCount = await prisma.trainingSession.count({
    where: { athleteId, status: "COMPLETED" },
  });

  for (const badge of SESSION_BADGES) {
    if (sessionCount >= badge.count) {
      await upsertAchievement({
        athleteId,
        badgeKey: badge.badgeKey,
        type: "MILESTONE",
        title: badge.title,
        description: badge.description,
        metadata: { sessions: sessionCount },
      });
    }
  }
}

/**
 * Award the first check-in badge (one-time, idempotent).
 */
export async function awardFirstCheckInAchievement(
  athleteId: string
): Promise<void> {
  const checkInCount = await prisma.readinessCheckIn.count({
    where: { athleteId },
  });
  if (checkInCount <= 1) {
    await upsertAchievement({
      athleteId,
      badgeKey: "checkin_first",
      type: "TRAINING",
      title: "First Check-In ✅",
      description: "Completed your first daily readiness check-in.",
    });
  }
}
