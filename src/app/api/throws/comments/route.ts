import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { sendPushToUser } from "@/lib/push";

const TARGET_FIELDS = [
  "throwLogId",
  "practiceAttemptId",
  "trainingSessionId",
  "throwsAssignmentId",
] as const;

type TargetField = (typeof TARGET_FIELDS)[number];

/* ─── GET — fetch comments for a target ──────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const targetField = url.searchParams.get("targetField") as TargetField | null;
    const targetId = url.searchParams.get("targetId");

    if (!targetField || !targetId || !TARGET_FIELDS.includes(targetField)) {
      return NextResponse.json(
        { success: false, error: "targetField and targetId are required" },
        { status: 400 }
      );
    }

    // Verify the user has access to this target
    const hasAccess = await verifyAccess(session.userId, session.role, targetField, targetId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const comments = await prisma.throwComment.findMany({
      where: { [targetField]: targetId },
      orderBy: { createdAt: "asc" },
    });

    // Enrich with author names
    const authorIds = [...new Set(comments.map((c) => c.authorId))];
    const users = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: {
        id: true,
        email: true,
        coachProfile: { select: { firstName: true, lastName: true, avatarUrl: true } },
        athleteProfile: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enriched = comments.map((c) => {
      const user = userMap.get(c.authorId);
      const profile = c.authorRole === "COACH" ? user?.coachProfile : user?.athleteProfile;
      return {
        id: c.id,
        authorId: c.authorId,
        authorRole: c.authorRole,
        authorName: profile ? `${profile.firstName} ${profile.lastName}` : user?.email ?? "Unknown",
        authorAvatar: profile?.avatarUrl ?? null,
        body: c.body,
        audioUrl: c.audioUrl,
        audioDurationSec: c.audioDurationSec,
        createdAt: c.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (err) {
    logger.error("GET /api/throws/comments", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to fetch comments" }, { status: 500 });
  }
}

/* ─── POST — create a comment ────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      targetField,
      targetId,
      text,
      audioUrl,
      audioDurationSec,
    } = body as Record<string, unknown>;

    if (
      typeof targetField !== "string" ||
      !TARGET_FIELDS.includes(targetField as TargetField) ||
      typeof targetId !== "string"
    ) {
      return NextResponse.json(
        { success: false, error: "targetField and targetId are required" },
        { status: 400 }
      );
    }

    // A comment needs EITHER text OR audio. Both cannot be empty.
    const hasText = typeof text === "string" && text.trim().length > 0;
    const hasAudio =
      typeof audioUrl === "string" &&
      audioUrl.trim().length > 0 &&
      typeof audioDurationSec === "number" &&
      audioDurationSec > 0;

    if (!hasText && !hasAudio) {
      return NextResponse.json(
        { success: false, error: "Comment must include either text or a voice note." },
        { status: 400 }
      );
    }

    // Voice notes: enforce 30s cap server-side as a defense in depth
    // against a crafted client that bypasses the UI limit.
    if (hasAudio && (audioDurationSec as number) > 30) {
      return NextResponse.json(
        { success: false, error: "Voice notes are limited to 30 seconds." },
        { status: 400 }
      );
    }

    // Verify access
    const hasAccess = await verifyAccess(
      session.userId,
      session.role,
      targetField as TargetField,
      targetId
    );
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Body is required by the schema (NOT NULL). For voice-only comments,
    // store a placeholder that's easy to filter/display ("[voice note]").
    const bodyText = hasText ? (text as string).trim() : "[voice note]";

    const comment = await prisma.throwComment.create({
      data: {
        authorId: session.userId,
        authorRole: session.role,
        [targetField]: targetId,
        body: bodyText,
        audioUrl: hasAudio ? (audioUrl as string) : null,
        audioDurationSec: hasAudio
          ? Math.ceil(audioDurationSec as number)
          : null,
      },
    });

    // Get author info for response
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        email: true,
        coachProfile: { select: { firstName: true, lastName: true, avatarUrl: true } },
        athleteProfile: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    });
    const profile = session.role === "COACH" ? user?.coachProfile : user?.athleteProfile;

    // Create notification for the other party — use a voice-note-friendly
    // preview when the comment has no text content.
    const notificationPreview = hasText
      ? (text as string).trim()
      : `🎙 Voice note (${Math.ceil(audioDurationSec as number)}s)`;
    await createCommentNotification(
      session.userId,
      session.role,
      targetField as TargetField,
      targetId,
      notificationPreview
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          id: comment.id,
          authorId: comment.authorId,
          authorRole: comment.authorRole,
          authorName: profile
            ? `${profile.firstName} ${profile.lastName}`
            : user?.email ?? "Unknown",
          authorAvatar: profile?.avatarUrl ?? null,
          body: comment.body,
          audioUrl: comment.audioUrl,
          audioDurationSec: comment.audioDurationSec,
          createdAt: comment.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("POST /api/throws/comments", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to create comment" }, { status: 500 });
  }
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

async function verifyAccess(
  userId: string,
  role: string,
  targetField: TargetField,
  targetId: string
): Promise<boolean> {
  if (role === "COACH") {
    const coach = await prisma.coachProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!coach) return false;

    switch (targetField) {
      case "throwLogId": {
        const tl = await prisma.throwLog.findUnique({
          where: { id: targetId },
          select: { athlete: { select: { coachId: true } } },
        });
        return tl?.athlete.coachId === coach.id;
      }
      case "practiceAttemptId": {
        const pa = await prisma.practiceAttempt.findUnique({
          where: { id: targetId },
          select: { session: { select: { coachId: true } } },
        });
        return pa?.session.coachId === coach.id;
      }
      case "trainingSessionId": {
        const ts = await prisma.trainingSession.findUnique({
          where: { id: targetId },
          select: { athlete: { select: { coachId: true } } },
        });
        return ts?.athlete.coachId === coach.id;
      }
      case "throwsAssignmentId": {
        const ta = await prisma.throwsAssignment.findUnique({
          where: { id: targetId },
          select: { session: { select: { coachId: true } } },
        });
        return ta?.session.coachId === coach.id;
      }
    }
  }

  if (role === "ATHLETE") {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!athlete) return false;

    switch (targetField) {
      case "throwLogId": {
        const tl = await prisma.throwLog.findUnique({
          where: { id: targetId },
          select: { athleteId: true },
        });
        return tl?.athleteId === athlete.id;
      }
      case "practiceAttemptId": {
        const pa = await prisma.practiceAttempt.findUnique({
          where: { id: targetId },
          select: { athleteId: true },
        });
        return pa?.athleteId === athlete.id;
      }
      case "trainingSessionId": {
        const ts = await prisma.trainingSession.findUnique({
          where: { id: targetId },
          select: { athleteId: true },
        });
        return ts?.athleteId === athlete.id;
      }
      case "throwsAssignmentId": {
        const ta = await prisma.throwsAssignment.findUnique({
          where: { id: targetId },
          select: { athleteId: true },
        });
        return ta?.athleteId === athlete.id;
      }
    }
  }

  return false;
}

async function createCommentNotification(
  authorUserId: string,
  authorRole: string,
  targetField: TargetField,
  targetId: string,
  commentText: string
) {
  try {
    const preview = commentText.length > 80 ? commentText.slice(0, 77) + "..." : commentText;

    // Enriched metadata — includes IDs the URL resolver needs for navigation
    const metadata: Record<string, string> = { targetField, targetId, type: "throw_comment" };

    if (authorRole === "ATHLETE") {
      // Find the athlete's coach and notify them
      const athlete = await prisma.athleteProfile.findUnique({
        where: { userId: authorUserId },
        select: { id: true, coachId: true, firstName: true, lastName: true },
      });
      if (!athlete?.coachId) return;

      metadata.athleteId = athlete.id;

      // For practice attempts, include parent session ID for coach navigation
      if (targetField === "practiceAttemptId") {
        const attempt = await prisma.practiceAttempt.findUnique({
          where: { id: targetId },
          select: { sessionId: true },
        });
        if (attempt) metadata.practiceSessionId = attempt.sessionId;
      }

      const title = `${athlete.firstName} left a comment`;
      await prisma.notification.create({
        data: {
          coachId: athlete.coachId,
          athleteId: athlete.id,
          type: "COMMENT_ADDED",
          title,
          body: preview,
          metadata: JSON.stringify(metadata),
        },
      });

      // Fire a Web Push to the coach (best-effort, non-blocking).
      // Resolve the coach's userId from coachId so sendPushToUser can
      // look up their subscriptions.
      const coach = await prisma.coachProfile.findUnique({
        where: { id: athlete.coachId },
        select: { userId: true },
      });
      if (coach) {
        void sendPushToUser(coach.userId, {
          title,
          body: preview,
          url: "/coach/feedback-inbox",
          tag: `comment-${targetField}-${targetId}`,
          data: metadata,
        }).catch(() => null);
      }
    }

    if (authorRole === "COACH") {
      // Find the athlete from the target and notify them
      let athleteProfileId: string | null = null;

      if (targetField === "throwsAssignmentId") {
        const assignment = await prisma.throwsAssignment.findUnique({
          where: { id: targetId },
          select: { athleteId: true },
        });
        athleteProfileId = assignment?.athleteId ?? null;
      } else if (targetField === "throwLogId") {
        const throwLog = await prisma.throwLog.findUnique({
          where: { id: targetId },
          select: { athleteId: true },
        });
        athleteProfileId = throwLog?.athleteId ?? null;
      } else if (targetField === "practiceAttemptId") {
        const attempt = await prisma.practiceAttempt.findUnique({
          where: { id: targetId },
          select: { athleteId: true, sessionId: true },
        });
        athleteProfileId = attempt?.athleteId ?? null;
        if (attempt?.sessionId) metadata.practiceSessionId = attempt.sessionId;
      } else if (targetField === "trainingSessionId") {
        const ts = await prisma.trainingSession.findUnique({
          where: { id: targetId },
          select: { athleteId: true },
        });
        athleteProfileId = ts?.athleteId ?? null;
      }

      if (!athleteProfileId) return;

      metadata.athleteId = athleteProfileId;

      const coach = await prisma.coachProfile.findUnique({
        where: { userId: authorUserId },
        select: { firstName: true, lastName: true },
      });
      const coachName = coach ? `${coach.firstName} ${coach.lastName}` : "Your coach";
      const title = `${coachName} left a comment`;

      await prisma.notification.create({
        data: {
          athleteProfileId,
          type: "COMMENT_ADDED",
          title,
          body: preview,
          metadata: JSON.stringify(metadata),
        },
      });

      // Fire a Web Push to the athlete (best-effort, non-blocking).
      // Resolve the athlete's userId so sendPushToUser can look up
      // their subscriptions.
      const athleteRecord = await prisma.athleteProfile.findUnique({
        where: { id: athleteProfileId },
        select: { userId: true },
      });
      if (athleteRecord) {
        void sendPushToUser(athleteRecord.userId, {
          title,
          body: preview,
          url: "/athlete/feedback",
          tag: `comment-${targetField}-${targetId}`,
          data: metadata,
        }).catch(() => null);
      }
    }
  } catch (err) {
    // Non-fatal
    logger.error("Failed to create comment notification", { context: "throws/comments", error: err });
  }
}
