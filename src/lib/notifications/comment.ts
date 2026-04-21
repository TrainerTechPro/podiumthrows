/**
 * Comment notification fan-out — push + email + in-app, preference-aware.
 *
 * Called from POST /api/throws/comments AFTER a comment row is created.
 * Never throws into the caller — every delivery channel is best-effort.
 *
 * Reads NotificationPreference for the recipient to decide which channels
 * fire. Push is additionally gated by quiet hours and 2-minute coalescing.
 * The in-app Notification row always writes (it is the source of truth for
 * the inbox).
 */

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendPushToUser } from "@/lib/push";
import { sendCommentAddedEmail } from "@/lib/email";
import type { TargetField } from "@/lib/comments/access";

const COMMENT_TYPE = "COMMENT_ADDED" as const;
const PUSH_COALESCE_WINDOW_MS = 2 * 60 * 1000;

type Args = {
  commentId: string;
  authorUserId: string;
  authorRole: string;
  targetField: TargetField;
  targetId: string;
  preview: string;
};

export function sendCommentNotification(args: Args): Promise<void> {
  return fanOut(args).catch((err) => {
    logger.error("Comment notification fan-out failed", {
      context: "notifications/comment",
      error: err,
      metadata: { commentId: args.commentId },
    });
  });
}

async function fanOut(args: Args): Promise<void> {
  const { authorUserId, authorRole, targetField, targetId, preview } = args;

  const recipient = await resolveRecipient(authorUserId, authorRole, targetField, targetId);
  if (!recipient) return;

  const { recipientUserId, recipientCoachId, recipientAthleteProfileId, athleteId } = recipient;
  const authorName = await resolveAuthorName(authorUserId, authorRole);
  const title = `${authorName} left a comment`;
  const bodyPreview = preview.length > 80 ? preview.slice(0, 77) + "..." : preview;

  const metadata: Record<string, string> = {
    targetField,
    targetId,
    type: "throw_comment",
  };
  if (athleteId) metadata.athleteId = athleteId;
  if (targetField === "practiceAttemptId") {
    const attempt = await prisma.practiceAttempt.findUnique({
      where: { id: targetId },
      select: { sessionId: true },
    });
    if (attempt?.sessionId) metadata.practiceSessionId = attempt.sessionId;
  }

  const prefs = await getOrCreatePreference(recipientUserId);
  const channels = resolveChannels(prefs);

  if (channels.inApp) {
    await prisma.notification
      .create({
        data: {
          coachId: recipientCoachId,
          athleteProfileId: recipientAthleteProfileId,
          type: COMMENT_TYPE,
          title,
          body: bodyPreview,
          metadata: JSON.stringify(metadata),
        },
      })
      .catch((err) => {
        logger.error("Notification row create failed", {
          context: "notifications/comment",
          error: err,
        });
      });
  }

  if (channels.push && !inQuietHours(prefs)) {
    const shouldCoalesce = await recentPushExists(authorUserId, targetField, targetId);
    if (!shouldCoalesce) {
      void sendPushToUser(recipientUserId, {
        title,
        body: bodyPreview,
        url: authorRole === "ATHLETE" ? "/coach/feedback-inbox" : "/athlete/feedback",
        tag: `comment-${targetField}-${targetId}`,
        data: metadata,
      }).catch(() => null);
    }
  }

  if (channels.email) {
    const recipientEmail = await prisma.user
      .findUnique({ where: { id: recipientUserId }, select: { email: true } })
      .then((u) => u?.email ?? null);
    if (recipientEmail) {
      void sendCommentAddedEmail(recipientEmail, {
        authorName,
        surfaceLabel: surfaceLabelFor(targetField),
        preview: bodyPreview,
        commentId: args.commentId,
        isAthleteRecipient: authorRole === "COACH",
      }).catch((err) => {
        logger.error("Comment email failed", {
          context: "notifications/comment",
          error: err,
        });
      });
    }
  }
}

/* ─── Recipient + author resolution ─────────────────────────────────────── */

type Recipient = {
  recipientUserId: string;
  recipientCoachId: string | null;
  recipientAthleteProfileId: string | null;
  athleteId: string | null;
};

async function resolveRecipient(
  authorUserId: string,
  authorRole: string,
  targetField: TargetField,
  targetId: string
): Promise<Recipient | null> {
  if (authorRole === "ATHLETE") {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: authorUserId },
      select: { id: true, coachId: true },
    });
    if (!athlete?.coachId) return null;
    const coach = await prisma.coachProfile.findUnique({
      where: { id: athlete.coachId },
      select: { userId: true, id: true },
    });
    if (!coach) return null;
    return {
      recipientUserId: coach.userId,
      recipientCoachId: coach.id,
      recipientAthleteProfileId: athlete.id,
      athleteId: athlete.id,
    };
  }

  if (authorRole === "COACH") {
    const athleteProfileId = await athleteIdForTarget(targetField, targetId);
    if (!athleteProfileId) return null;
    const athlete = await prisma.athleteProfile.findUnique({
      where: { id: athleteProfileId },
      select: { userId: true, id: true },
    });
    if (!athlete?.userId) return null;
    return {
      recipientUserId: athlete.userId,
      recipientCoachId: null,
      recipientAthleteProfileId: athlete.id,
      athleteId: athlete.id,
    };
  }

  return null;
}

async function athleteIdForTarget(
  targetField: TargetField,
  targetId: string
): Promise<string | null> {
  switch (targetField) {
    case "throwLogId": {
      const row = await prisma.throwLog.findUnique({
        where: { id: targetId },
        select: { athleteId: true },
      });
      return row?.athleteId ?? null;
    }
    case "practiceAttemptId": {
      const row = await prisma.practiceAttempt.findUnique({
        where: { id: targetId },
        select: { athleteId: true },
      });
      return row?.athleteId ?? null;
    }
    case "trainingSessionId": {
      const row = await prisma.trainingSession.findUnique({
        where: { id: targetId },
        select: { athleteId: true },
      });
      return row?.athleteId ?? null;
    }
    case "throwsAssignmentId": {
      const row = await prisma.throwsAssignment.findUnique({
        where: { id: targetId },
        select: { athleteId: true },
      });
      return row?.athleteId ?? null;
    }
    case "athleteDrillLogId": {
      const row = await prisma.athleteDrillLog.findUnique({
        where: { id: targetId },
        select: { session: { select: { athleteId: true } } },
      });
      return row?.session.athleteId ?? null;
    }
    case "videoAnalysisId": {
      const row = await prisma.videoAnalysis.findUnique({
        where: { id: targetId },
        select: { athleteId: true },
      });
      return row?.athleteId ?? null;
    }
  }
}

async function resolveAuthorName(authorUserId: string, authorRole: string): Promise<string> {
  if (authorRole === "COACH") {
    const coach = await prisma.coachProfile.findUnique({
      where: { userId: authorUserId },
      select: { firstName: true, lastName: true },
    });
    return coach ? `${coach.firstName} ${coach.lastName}` : "Your coach";
  }
  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: authorUserId },
    select: { firstName: true, lastName: true },
  });
  return athlete ? `${athlete.firstName} ${athlete.lastName}` : "Your athlete";
}

/* ─── Preference + quiet hours ──────────────────────────────────────────── */

type Prefs = {
  pushEnabled: boolean;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  typeOverrides: Record<string, Partial<{ push: boolean; email: boolean; inApp: boolean }>>;
  quietStart: string | null;
  quietEnd: string | null;
  timezone: string | null;
};

async function getOrCreatePreference(userId: string): Promise<Prefs> {
  const existing = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (existing) {
    return {
      pushEnabled: existing.pushEnabled,
      emailEnabled: existing.emailEnabled,
      inAppEnabled: existing.inAppEnabled,
      typeOverrides: (existing.typeOverrides as Prefs["typeOverrides"]) ?? {},
      quietStart: existing.quietStart,
      quietEnd: existing.quietEnd,
      timezone: existing.timezone,
    };
  }
  const created = await prisma.notificationPreference
    .create({
      data: {
        userId,
        pushEnabled: true,
        emailEnabled: true,
        inAppEnabled: true,
        typeOverrides: {},
        quietStart: "22:00",
        quietEnd: "07:00",
      },
    })
    .catch(() => null);
  return {
    pushEnabled: created?.pushEnabled ?? true,
    emailEnabled: created?.emailEnabled ?? true,
    inAppEnabled: created?.inAppEnabled ?? true,
    typeOverrides: {},
    quietStart: created?.quietStart ?? "22:00",
    quietEnd: created?.quietEnd ?? "07:00",
    timezone: created?.timezone ?? null,
  };
}

function resolveChannels(prefs: Prefs): { push: boolean; email: boolean; inApp: boolean } {
  const override = prefs.typeOverrides[COMMENT_TYPE] ?? {};
  return {
    push: prefs.pushEnabled && (override.push ?? true),
    email: prefs.emailEnabled && (override.email ?? true),
    inApp: prefs.inAppEnabled && (override.inApp ?? true),
  };
}

/**
 * Quiet-hours check in the recipient's timezone.
 * quietStart/quietEnd are "HH:mm" strings; null disables the gate.
 * Wrap-around across midnight is supported (22:00 → 07:00).
 */
export function inQuietHours(
  prefs: Pick<Prefs, "quietStart" | "quietEnd" | "timezone">,
  now: Date = new Date()
): boolean {
  if (!prefs.quietStart || !prefs.quietEnd) return false;
  const tz = prefs.timezone || "UTC";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const nowMin = hour * 60 + minute;
  const start = toMinutes(prefs.quietStart);
  const end = toMinutes(prefs.quietEnd);
  if (start === null || end === null) return false;
  if (start === end) return false;
  if (start > end) return nowMin >= start || nowMin < end;
  return nowMin >= start && nowMin < end;
}

function toMinutes(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Push coalescing — if the same author posted on this target in the last
 * 2 minutes (not counting the just-created comment), skip the push. The
 * in-app row still writes.
 */
async function recentPushExists(
  authorUserId: string,
  targetField: TargetField,
  targetId: string
): Promise<boolean> {
  const since = new Date(Date.now() - PUSH_COALESCE_WINDOW_MS);
  const recent = await prisma.throwComment.findFirst({
    where: {
      authorId: authorUserId,
      [targetField]: targetId,
      createdAt: { gte: since },
    } as Prisma.ThrowCommentWhereInput,
    orderBy: { createdAt: "desc" },
    skip: 1,
    select: { id: true },
  });
  return recent !== null;
}

function surfaceLabelFor(targetField: TargetField): string {
  switch (targetField) {
    case "throwLogId":
      return "a throw";
    case "practiceAttemptId":
      return "a practice attempt";
    case "trainingSessionId":
      return "a training session";
    case "throwsAssignmentId":
      return "an assignment";
    case "athleteDrillLogId":
      return "a drill";
    case "videoAnalysisId":
      return "a video";
  }
}
