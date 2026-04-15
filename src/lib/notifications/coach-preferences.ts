/**
 * Coach notification preferences — per-type opt-outs.
 *
 * Defaults are opt-IN (true). A missing key, a null prefs blob, or a
 * coach with no prefs row at all all resolve to "enabled" so that newly
 * wired notification types reach coaches without requiring a settings
 * visit first.
 *
 * Sits under src/lib/notifications/ (new folder) rather than src/lib/
 * to keep room for parallel push/email preference modules alongside.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { NotificationType } from "@/lib/notifications";

/** The 8 NotificationTypes that currently have notifyCoach* writers. */
export const COACH_NOTIFICATION_TYPES = [
  "PR_ALERT",
  "LOW_READINESS",
  "ATHLETE_JOINED",
  "PROGRAM_CHECKPOINT",
  "COMPLEX_ROTATED",
  "INVITATION_EXPIRED",
  "QUESTIONNAIRE_COMPLETE",
  "PROGRAMMING_REQUESTED",
] as const satisfies readonly NotificationType[];

export type CoachNotificationType = (typeof COACH_NOTIFICATION_TYPES)[number];

export type CoachNotificationPreferences = {
  inApp: Record<CoachNotificationType, boolean>;
};

export const DEFAULT_COACH_PREFS: CoachNotificationPreferences = {
  inApp: Object.fromEntries(COACH_NOTIFICATION_TYPES.map((t) => [t, true])) as Record<
    CoachNotificationType,
    boolean
  >,
};

/**
 * Parse a raw `CoachProfile.notificationPreferences` JSON value into the
 * typed shape. Unknown/malformed values fall back to defaults. Missing
 * per-type keys default to TRUE (opt-in). Extra keys on the input are
 * ignored so the shape can evolve without migrations.
 */
export function parseCoachPrefs(raw: unknown): CoachNotificationPreferences {
  if (!raw || typeof raw !== "object") return DEFAULT_COACH_PREFS;

  const r = raw as Record<string, unknown>;
  const inAppRaw =
    r.inApp && typeof r.inApp === "object" ? (r.inApp as Record<string, unknown>) : {};

  const inApp = Object.fromEntries(
    COACH_NOTIFICATION_TYPES.map((t) => [t, inAppRaw[t] !== false])
  ) as Record<CoachNotificationType, boolean>;

  return { inApp };
}

/**
 * Fire-and-forget-safe check: returns `true` if the coach should receive
 * this notification type. A missing coach, DB error, or un-gated type
 * returns `true` (fail-open) so the notification tray stays useful even
 * when prefs are broken.
 */
export async function isCoachNotificationEnabled(
  coachId: string,
  type: NotificationType
): Promise<boolean> {
  // Un-gated types (no UI toggle) are always enabled.
  if (!(COACH_NOTIFICATION_TYPES as readonly string[]).includes(type)) {
    return true;
  }

  try {
    const coach = await prisma.coachProfile.findUnique({
      where: { id: coachId },
      select: { notificationPreferences: true },
    });
    if (!coach) return true;
    const prefs = parseCoachPrefs(coach.notificationPreferences);
    return prefs.inApp[type as CoachNotificationType];
  } catch (err) {
    // Fail-open: a prefs lookup failure should never swallow the
    // coach's notification. Log so we notice systemic breakage.
    logger.error("isCoachNotificationEnabled lookup failed", {
      context: "notifications",
      metadata: { coachId, type },
      error: err,
    });
    return true;
  }
}
