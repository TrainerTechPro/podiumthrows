import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type PushPreferences = {
  coachFeedback: boolean;
  teammatePRs: boolean;
  streakReminder: boolean;
  weeklyGoalReminder: boolean;
  practiceReminder: boolean;
  /** Sunday weekly recap — email channel. */
  weeklyRecapEmail: boolean;
  /** Sunday weekly recap — in-app notification channel. */
  weeklyRecapInApp: boolean;
};

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  coachFeedback: true,
  teammatePRs: true,
  streakReminder: true,
  weeklyGoalReminder: true,
  practiceReminder: true,
  weeklyRecapEmail: true,
  weeklyRecapInApp: true,
};

export type PushPreferenceKey = keyof PushPreferences;

/** Parse pushPreferences out of the athlete's notificationPreferences JSON. */
export function parsePushPreferences(raw: unknown): PushPreferences {
  if (!raw || typeof raw !== "object") return DEFAULT_PUSH_PREFERENCES;
  const r = raw as Record<string, unknown>;
  const p =
    r.pushPreferences && typeof r.pushPreferences === "object"
      ? (r.pushPreferences as Record<string, unknown>)
      : {};
  return {
    coachFeedback:
      typeof p.coachFeedback === "boolean"
        ? p.coachFeedback
        : DEFAULT_PUSH_PREFERENCES.coachFeedback,
    teammatePRs:
      typeof p.teammatePRs === "boolean" ? p.teammatePRs : DEFAULT_PUSH_PREFERENCES.teammatePRs,
    streakReminder:
      typeof p.streakReminder === "boolean"
        ? p.streakReminder
        : DEFAULT_PUSH_PREFERENCES.streakReminder,
    weeklyGoalReminder:
      typeof p.weeklyGoalReminder === "boolean"
        ? p.weeklyGoalReminder
        : DEFAULT_PUSH_PREFERENCES.weeklyGoalReminder,
    practiceReminder:
      typeof p.practiceReminder === "boolean"
        ? p.practiceReminder
        : DEFAULT_PUSH_PREFERENCES.practiceReminder,
    weeklyRecapEmail:
      typeof p.weeklyRecapEmail === "boolean"
        ? p.weeklyRecapEmail
        : DEFAULT_PUSH_PREFERENCES.weeklyRecapEmail,
    weeklyRecapInApp:
      typeof p.weeklyRecapInApp === "boolean"
        ? p.weeklyRecapInApp
        : DEFAULT_PUSH_PREFERENCES.weeklyRecapInApp,
  };
}

/**
 * Fetch the athlete's push preferences. Returns defaults if athlete not found
 * or preferences are missing.
 */
export async function getPushPreferences(athleteId: string): Promise<PushPreferences> {
  try {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { notificationPreferences: true },
    });
    if (!athlete) return DEFAULT_PUSH_PREFERENCES;
    return parsePushPreferences(athlete.notificationPreferences);
  } catch (err) {
    logger.error("getPushPreferences failed", { metadata: { athleteId }, error: err });
    return DEFAULT_PUSH_PREFERENCES;
  }
}

/** Look up by userId instead of athleteId — convenience for places that have userId. */
export async function getPushPreferencesByUserId(userId: string): Promise<PushPreferences> {
  try {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId },
      select: { notificationPreferences: true },
    });
    if (!athlete) return DEFAULT_PUSH_PREFERENCES;
    return parsePushPreferences(athlete.notificationPreferences);
  } catch (err) {
    logger.error("getPushPreferencesByUserId failed", { userId, error: err });
    return DEFAULT_PUSH_PREFERENCES;
  }
}

/**
 * Feed privacy setting stored alongside push preferences.
 * "public"  — activity shows to all teammates (default)
 * "private" — activity hidden from team feed; only the athlete sees it
 */
export type FeedPrivacy = "public" | "private";
export const DEFAULT_FEED_PRIVACY: FeedPrivacy = "public";

export function parseFeedPrivacy(raw: unknown): FeedPrivacy {
  if (!raw || typeof raw !== "object") return DEFAULT_FEED_PRIVACY;
  const r = raw as Record<string, unknown>;
  return r.feedPrivacy === "private" ? "private" : "public";
}

/**
 * Update push preferences for an athlete. Merges with existing notificationPreferences
 * to preserve feedPrivacy and other keys.
 */
export async function updatePushPreferences(
  athleteId: string,
  updates: Partial<PushPreferences>
): Promise<PushPreferences> {
  const athlete = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    select: { notificationPreferences: true },
  });
  const existing = (athlete?.notificationPreferences as Record<string, unknown>) ?? {};
  const existingPush = parsePushPreferences(existing);
  const merged = { ...existingPush, ...updates };

  await prisma.athleteProfile.update({
    where: { id: athleteId },
    data: {
      notificationPreferences: {
        ...existing,
        pushPreferences: merged,
      },
    },
  });

  return merged;
}
