/**
 * Notification Helpers — Podium Throws
 *
 * Creates Notification records for coaches. All functions are fire-and-forget
 * safe — callers should wrap in void + .catch(console.error).
 */

import { prisma } from "@/lib/prisma";
import { formatEventType } from "@/lib/utils";

// ─── Notification Types ───────────────────────────────────────────────────────

export type NotificationType =
  | "PR_ALERT"
  | "LOW_READINESS"
  | "QUESTIONNAIRE_COMPLETE"
  | "STREAK_BROKEN";

// ─── Creators ─────────────────────────────────────────────────────────────────

/**
 * Notify coach that an athlete hit a new personal best.
 */
export async function notifyCoachPR(
  coachId: string,
  athleteId: string,
  athleteName: string,
  event: string,
  distance: number,
  unit: string = "m"
): Promise<void> {
  const eventLabel = formatEventType(event);
  await prisma.notification.create({
    data: {
      coachId,
      athleteId,
      type: "PR_ALERT",
      title: `New PR — ${athleteName}`,
      body: `${athleteName} just hit a new ${eventLabel} PR: ${distance.toFixed(2)}${unit}`,
      metadata: { event, distance, unit, athleteName },
    },
  });
}

/**
 * Notify coach of a low readiness score (only fires when score ≤ 4).
 */
export async function notifyCoachLowReadiness(
  coachId: string,
  athleteId: string,
  athleteName: string,
  score: number
): Promise<void> {
  if (score > 4) return; // Only alert when truly low
  await prisma.notification.create({
    data: {
      coachId,
      athleteId,
      type: "LOW_READINESS",
      title: `Low Readiness — ${athleteName}`,
      body: `${athleteName} checked in with a readiness score of ${score.toFixed(1)}/10. Consider adjusting today's training load.`,
      metadata: { readinessScore: score, athleteName },
    },
  });
}

/**
 * Notify coach that an athlete completed a questionnaire.
 */
export async function notifyCoachQuestionnaireComplete(
  coachId: string,
  athleteId: string,
  athleteName: string,
  questionnaireName: string
): Promise<void> {
  await prisma.notification.create({
    data: {
      coachId,
      athleteId,
      type: "QUESTIONNAIRE_COMPLETE",
      title: `Questionnaire Completed — ${athleteName}`,
      body: `${athleteName} completed "${questionnaireName}".`,
      metadata: { questionnaireName, athleteName },
    },
  });
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Count unread notifications for a coach. Used for the sidebar badge.
 */
export async function getUnreadNotificationCount(
  coachId: string
): Promise<number> {
  return prisma.notification.count({
    where: { coachId, read: false },
  });
}
