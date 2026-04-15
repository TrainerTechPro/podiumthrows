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
 * Fire when an adaptation checkpoint is created for an athlete's Program.
 * Coach-facing; athletes don't see the underlying periodization bookkeeping.
 * Body surfaces the engine's recommendation so the coach can act without
 * drilling in.
 */
export async function notifyCoachProgramCheckpoint(
  coachId: string,
  athleteProfileId: string,
  athleteName: string,
  args: {
    programId: string;
    checkpointId: string;
    weekNumber: number;
    recommendation: string;
  }
): Promise<void> {
  // Humanize the recommendation code for the body copy.
  const recLabel = args.recommendation
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  await createNotification({
    type: "PROGRAM_CHECKPOINT",
    coachId,
    athleteProfileId,
    title: `Checkpoint: ${athleteName}`,
    body: `Engine recommends ${recLabel} at week ${args.weekNumber}. Tap to review.`,
    metadata: {
      ...args,
      athleteName,
      url: `/coach/athletes/${athleteProfileId}`,
    },
  });
}

/**
 * Fire when an athlete's exercise complex rotates (Bondarchuk 45-day rule
 * or explicit coach trigger). Coach-facing so they know to walk the
 * athlete through the new exercises at the next session.
 */
export async function notifyCoachComplexRotated(
  coachId: string,
  athleteProfileId: string,
  athleteName: string,
  args: {
    programId: string;
    complexNumber: number;
  }
): Promise<void> {
  await createNotification({
    type: "COMPLEX_ROTATED",
    coachId,
    athleteProfileId,
    title: `Complex rotated: ${athleteName}`,
    body: `Complex #${args.complexNumber} is live. Walk through the new exercises at the next session.`,
    metadata: {
      ...args,
      athleteName,
      url: `/coach/athletes/${athleteProfileId}`,
    },
  });
}

/**
 * Fire when a coach shares a video with an athlete. Only fires for
 * newly-added athletes (re-saving the share with the same athlete in
 * the list doesn't re-notify) — the calling route is responsible for
 * diffing against the existing sharedWithAthletes array.
 */
export async function notifyAthleteVideoShared(
  athleteProfileId: string,
  videoId: string,
  videoTitle: string | null
): Promise<void> {
  const label = videoTitle?.trim() || "a new video";
  await createNotification({
    type: "VIDEO_SHARED",
    athleteProfileId,
    title: "Coach shared a video",
    body: `Your coach shared ${label} with you. Tap to watch.`,
    metadata: {
      videoId,
      videoTitle: videoTitle ?? null,
      url: `/athlete/videos/${videoId}`,
    },
  });
}

/**
 * Fire when an athlete's upcoming competition crosses a reminder threshold.
 * Two thresholds fire per competition: 7 days out (planning horizon) and
 * 1 day out (tomorrow). Each threshold fires on exactly one calendar day
 * (the day that's 7 or 1 days before the competition date) so idempotency
 * is intrinsic to the cron schedule — no dedup query needed.
 */
export async function notifyAthleteCompetitionReminder(
  athleteProfileId: string,
  competitionId: string,
  name: string,
  event: string,
  date: string,
  threshold: "7_DAYS" | "1_DAY"
): Promise<void> {
  const eventLabel = formatEventType(event);
  const title = threshold === "1_DAY" ? `${name} is tomorrow` : `${name} is 1 week away`;
  const body =
    threshold === "1_DAY"
      ? `Your ${eventLabel} competition is tomorrow. Good luck!`
      : `Your ${eventLabel} competition ${name} is 7 days out. Time to finalize prep.`;
  await createNotification({
    type: "COMPETITION_REMINDER",
    athleteProfileId,
    title,
    body,
    metadata: {
      competitionId,
      name,
      event,
      date,
      threshold,
      url: "/athlete/competitions",
    },
  });
}

/**
 * Fire when an athlete's training streak has lapsed. Only meaningful
 * streaks (>= MIN_STREAK_FOR_NOTIFICATION days) are worth mourning;
 * short streaks breaking silently is better UX than a nag. Called by
 * the daily detect-broken-streaks cron after flipping currentStreak to
 * 0 in the database.
 */
export async function notifyAthleteStreakBroken(
  athleteProfileId: string,
  previousStreak: number
): Promise<void> {
  await createNotification({
    type: "STREAK_BROKEN",
    athleteProfileId,
    title: `Your ${previousStreak}-day streak ended`,
    body: `Log a throw today to start a new one. The best streaks come back stronger.`,
    metadata: {
      previousStreak,
      url: "/athlete/quick-log",
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
