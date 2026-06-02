import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { sendCommentNotification } from "@/lib/notifications/comment";
import { rateLimit } from "@/lib/rate-limit";
import { type TargetField, isTargetField, verifyCommentAccess } from "@/lib/comments/access";
import { parseBody, CommentCreateSchema } from "@/lib/api-schemas";
import { toServeUrl } from "@/lib/r2";

/* ─── GET — fetch comments for a target ──────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const rawTargetField = url.searchParams.get("targetField");
    const targetId = url.searchParams.get("targetId");

    if (!rawTargetField || !targetId || !isTargetField(rawTargetField)) {
      return NextResponse.json(
        { success: false, error: "targetField and targetId are required" },
        { status: 400 }
      );
    }
    const targetField: TargetField = rawTargetField;

    // Verify the user has access to this target
    const hasAccess = await verifyCommentAccess(
      session.userId,
      session.role,
      targetField,
      targetId
    );
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

    const enriched = await Promise.all(
      comments.map(async (c) => {
        const user = userMap.get(c.authorId);
        const profile = c.authorRole === "COACH" ? user?.coachProfile : user?.athleteProfile;
        const deleted = c.deletedAt != null;
        return {
          id: c.id,
          authorId: c.authorId,
          authorRole: c.authorRole,
          authorName: profile
            ? `${profile.firstName} ${profile.lastName}`
            : (user?.email ?? "Unknown"),
          authorAvatar: profile?.avatarUrl ?? null,
          body: deleted ? "" : c.body,
          audioUrl: deleted ? null : await toServeUrl(c.audioUrl),
          audioDurationSec: deleted ? null : c.audioDurationSec,
          readAt: c.readAt?.toISOString() ?? null,
          reaction: c.reaction,
          replyText: c.replyText,
          deleted,
          createdAt: c.createdAt.toISOString(),
        };
      })
    );

    return NextResponse.json({ success: true, data: enriched });
  } catch (err) {
    logger.error("GET /api/throws/comments", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Couldn’t fetch comments" }, { status: 500 });
  }
}

/* ─── POST — create a comment ────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Spam guardrail — 30 comments per minute per user (§Spec 5.3)
    const rl = await rateLimit(`comment-post:${session.userId}`, {
      maxAttempts: 30,
      windowMs: 60_000,
    });
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: "Too many comments. Take a breath." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } }
      );
    }

    const parsed = await parseBody(req, CommentCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { targetField, targetId, text, audioUrl, audioDurationSec } = parsed;

    if (!isTargetField(targetField)) {
      return NextResponse.json({ success: false, error: "Invalid targetField." }, { status: 400 });
    }

    const hasText = typeof text === "string" && text.trim().length > 0;
    const hasAudio =
      typeof audioUrl === "string" &&
      audioUrl.trim().length > 0 &&
      typeof audioDurationSec === "number" &&
      audioDurationSec > 0;

    // Voice notes: enforce 30s cap server-side as a defense in depth
    // against a crafted client that bypasses the UI limit.
    if (hasAudio && (audioDurationSec as number) > 30) {
      return NextResponse.json(
        { success: false, error: "Voice notes are limited to 30 seconds." },
        { status: 400 }
      );
    }

    const hasAccess = await verifyCommentAccess(
      session.userId,
      session.role,
      targetField,
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
        audioDurationSec: hasAudio ? Math.ceil(audioDurationSec as number) : null,
      } as Parameters<typeof prisma.throwComment.create>[0]["data"],
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

    // Fan out notification to the recipient per their preferences.
    // Non-blocking — wrapped in waitUntil internally.
    const notificationPreview = hasText
      ? (text as string).trim()
      : `🎙 Voice note (${Math.ceil(audioDurationSec as number)}s)`;
    void sendCommentNotification({
      commentId: comment.id,
      authorUserId: session.userId,
      authorRole: session.role,
      targetField: targetField as TargetField,
      targetId,
      preview: notificationPreview,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: comment.id,
          authorId: comment.authorId,
          authorRole: comment.authorRole,
          authorName: profile
            ? `${profile.firstName} ${profile.lastName}`
            : (user?.email ?? "Unknown"),
          authorAvatar: profile?.avatarUrl ?? null,
          body: comment.body,
          audioUrl: comment.audioUrl,
          audioDurationSec: comment.audioDurationSec,
          readAt: null,
          reaction: null,
          replyText: null,
          deleted: false,
          createdAt: comment.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("POST /api/throws/comments", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Couldn’t create comment" }, { status: 500 });
  }
}
