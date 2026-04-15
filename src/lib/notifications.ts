/**
 * Notification Service — Podium Throws
 *
 * Bi-directional: supports notifications for both coaches and athletes.
 * All creator functions are fire-and-forget safe — callers should wrap
 * in void + .catch(console.error).
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { formatEventType } from "@/lib/utils";

// ─── Notification Types ───────────────────────────────────────────────────────

export type NotificationType =
  | "WORKOUT_ASSIGNED"
  | "WORKOUT_COMPLETED"
  | "WORKOUT_SKIPPED"
  | "PR_ALERT"
  | "LOW_READINESS"
  | "QUESTIONNAIRE_ASSIGNED"
  | "QUESTIONNAIRE_COMPLETE"
  | "STREAK_BROKEN"
  | "ATHLETE_JOINED"
  | "PROGRAM_CHECKPOINT"
  | "COMPLEX_ROTATED"
  | "COMMENT_ADDED"
  | "VIDEO_SHARED"
  | "COMPETITION_REMINDER"
  | "INVITATION_EXPIRED"
  | "PROGRAMMING_REQUESTED";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  athleteProfileId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

// ─── Generic Creator ─────────────────────────────────────────────────────────

interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  coachId?: string;
  athleteProfileId?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  await prisma.notification.create({
    data: {
      type: input.type,
      title: input.title,
      body: input.body,
      coachId: input.coachId ?? null,
      athleteProfileId: input.athleteProfileId ?? null,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  });
}

// ─── Queries ─────────────────────────────────────────────────────────────────

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  read: true,
  athleteProfileId: true,
  metadata: true,
  createdAt: true,
} as const;

function serializeNotification(n: {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  athleteProfileId: string | null;
  metadata: unknown;
  createdAt: Date;
}): NotificationItem {
  return {
    ...n,
    metadata: n.metadata as Record<string, unknown> | null,
    createdAt: n.createdAt.toISOString(),
  };
}

/**
 * Get paginated notifications for a user by role.
 */
export async function getNotifications(
  profileId: string,
  role: "COACH" | "ATHLETE",
  opts: { page?: number; limit?: number; unreadOnly?: boolean; type?: string } = {}
): Promise<{ notifications: NotificationItem[]; total: number; unreadCount: number }> {
  const { page = 1, limit = 50, unreadOnly = false, type } = opts;
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    ...(role === "COACH" ? { coachId: profileId } : { athleteProfileId: profileId }),
    ...(unreadOnly ? { read: false } : {}),
    ...(type ? { type } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: NOTIFICATION_SELECT,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: {
        ...(role === "COACH" ? { coachId: profileId } : { athleteProfileId: profileId }),
        read: false,
      },
    }),
  ]);

  return {
    notifications: notifications.map(serializeNotification),
    total,
    unreadCount,
  };
}

/**
 * Count unread notifications for a user. Lightweight — used for badge polling.
 */
export async function getUnreadCount(
  profileId: string,
  role: "COACH" | "ATHLETE"
): Promise<number> {
  return prisma.notification.count({
    where: {
      ...(role === "COACH" ? { coachId: profileId } : { athleteProfileId: profileId }),
      read: false,
    },
  });
}

/**
 * Mark a single notification as read (with ownership check).
 */
export async function markAsRead(
  notificationId: string,
  profileId: string,
  role: "COACH" | "ATHLETE",
  read = true
): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      ...(role === "COACH" ? { coachId: profileId } : { athleteProfileId: profileId }),
    },
    data: { read },
  });
  return result.count > 0;
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(profileId: string, role: "COACH" | "ATHLETE"): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      ...(role === "COACH" ? { coachId: profileId } : { athleteProfileId: profileId }),
      read: false,
    },
    data: { read: true },
  });
}

// ─── Convenience Creators (backward-compatible) ──────────────────────────────

export async function notifyCoachPR(
  coachId: string,
  athleteProfileId: string,
  athleteName: string,
  event: string,
  distance: number,
  unit: string = "m"
): Promise<void> {
  const eventLabel = formatEventType(event);
  await createNotification({
    type: "PR_ALERT",
    coachId,
    athleteProfileId,
    title: `New PR — ${athleteName}`,
    body: `${athleteName} just hit a new ${eventLabel} PR: ${distance.toFixed(2)}${unit}`,
    metadata: { event, distance, unit, athleteName },
  });
}

export async function notifyCoachLowReadiness(
  coachId: string,
  athleteProfileId: string,
  athleteName: string,
  score: number
): Promise<void> {
  if (score > 4) return;
  await createNotification({
    type: "LOW_READINESS",
    coachId,
    athleteProfileId,
    title: `Low Readiness — ${athleteName}`,
    body: `${athleteName} checked in with a readiness score of ${score.toFixed(1)}/10. Consider adjusting today's training load.`,
    metadata: { readinessScore: score, athleteName },
  });
}

/**
 * Fire when an athlete joins the coach's roster — either via regular
 * registration through an email invite or via claiming a coach-created
 * proxy profile. The coach sees this in their in-app notification tray
 * alongside the existing `sendAthleteJoinedEmail` email.
 *
 * Context ("via") lets future UI surface the distinction: regular invite
 * claims vs proxy claims have different coach-followup semantics (proxy
 * claim → athlete inherits coach-populated PRs/notes; regular invite →
 * blank slate).
 */
export async function notifyCoachAthleteJoined(
  coachId: string,
  athleteProfileId: string,
  athleteName: string,
  via: "invite" | "proxy-claim"
): Promise<void> {
  const bodyByVia =
    via === "proxy-claim"
      ? `${athleteName} claimed the profile you set up. They now have app access.`
      : `${athleteName} joined your roster.`;
  await createNotification({
    type: "ATHLETE_JOINED",
    coachId,
    athleteProfileId,
    title: `New athlete — ${athleteName}`,
    body: bodyByVia,
    metadata: {
      athleteName,
      via,
      url: `/coach/athletes/${athleteProfileId}`,
    },
  });
}

/**
 * Fire when an invitation passes expiresAt without being claimed. Coach
 * can follow up by sending a new invite from the roster. Identity of the
 * expired invitee comes from the invitation itself — either a linked
 * athleteProfile (proxy path) or the email on record (direct-invite path).
 */
export async function notifyCoachInvitationExpired(
  coachId: string,
  inviteeLabel: string,
  metadata: {
    invitationId: string;
    athleteProfileId?: string;
    email?: string;
  }
): Promise<void> {
  await createNotification({
    type: "INVITATION_EXPIRED",
    coachId,
    athleteProfileId: metadata.athleteProfileId,
    title: `Invite expired — ${inviteeLabel}`,
    body: `Your invite for ${inviteeLabel} expired before they could claim it. Send a new one from your roster.`,
    metadata: {
      ...metadata,
      url: metadata.athleteProfileId
        ? `/coach/athletes/${metadata.athleteProfileId}`
        : "/coach/athletes",
    },
  });
}

/**
 * Fire when a questionnaire is assigned to an athlete — either manually
 * via /api/coach/questionnaires/[id]/assign or automatically via the
 * recurring-forms cron. Pairs with the existing notifyCoachQuestionnaireComplete
 * to close the coach→athlete→coach loop for questionnaires.
 */
export async function notifyAthleteQuestionnaireAssigned(
  athleteProfileId: string,
  questionnaireName: string,
  questionnaireId: string
): Promise<void> {
  await createNotification({
    type: "QUESTIONNAIRE_ASSIGNED",
    athleteProfileId,
    title: `New form: ${questionnaireName}`,
    body: `Your coach assigned you a new questionnaire. Tap to fill it out.`,
    metadata: {
      questionnaireId,
      questionnaireName,
      url: `/athlete/questionnaires/${questionnaireId}`,
    },
  });
}

export async function notifyCoachQuestionnaireComplete(
  coachId: string,
  athleteProfileId: string,
  athleteName: string,
  questionnaireName: string
): Promise<void> {
  await createNotification({
    type: "QUESTIONNAIRE_COMPLETE",
    coachId,
    athleteProfileId,
    title: `Questionnaire Completed — ${athleteName}`,
    body: `${athleteName} completed "${questionnaireName}".`,
    metadata: { questionnaireName, athleteName },
  });
}

/**
 * Athlete requests programming from their coach.
 * Replaces any existing PROGRAMMING_REQUESTED notification for this athlete
 * to prevent duplicate spam.
 */
export async function notifyCoachProgrammingRequested(
  coachId: string,
  athleteProfileId: string,
  athleteName: string,
  context: {
    events: string[];
    lastSessionDate: string | null;
    daysSinceLastSession: number | null;
    readinessScore: number | null;
    recentPRs: Array<{ event: string; distance: number; implement: string }>;
    goals: Array<{ title: string; progress: number }>;
    bondarchukType: string | null;
  }
): Promise<void> {
  // Delete any existing PROGRAMMING_REQUESTED for this athlete to prevent dupes
  await prisma.notification.deleteMany({
    where: {
      coachId,
      type: "PROGRAMMING_REQUESTED",
      athleteProfileId,
    },
  });

  // Build summary body
  const parts: string[] = [];
  if (context.daysSinceLastSession != null) {
    parts.push(
      `Last session ${context.daysSinceLastSession} day${context.daysSinceLastSession !== 1 ? "s" : ""} ago`
    );
  } else {
    parts.push("No sessions yet");
  }
  if (context.readinessScore != null) {
    parts.push(`Readiness ${context.readinessScore.toFixed(1)}`);
  }
  if (context.recentPRs.length > 0) {
    const best = context.recentPRs[0];
    parts.push(`${formatEventType(best.event)} PR ${best.distance.toFixed(2)}m`);
  }

  await createNotification({
    type: "PROGRAMMING_REQUESTED",
    coachId,
    athleteProfileId,
    title: `${athleteName} is requesting programming`,
    body: parts.join(" | "),
    metadata: {
      ...context,
      athleteName,
      link: `/coach/schedule?athlete=${athleteProfileId}`,
    },
  });
}

// ─── Legacy Exports ──────────────────────────────────────────────────────────

/**
 * @deprecated Use getUnreadCount() instead.
 */
export async function getUnreadNotificationCount(coachId: string): Promise<number> {
  return getUnreadCount(coachId, "COACH");
}
