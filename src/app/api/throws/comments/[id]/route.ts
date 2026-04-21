/**
 * PATCH /api/throws/comments/[id]
 *
 * Recipient-side acknowledgment endpoint. Lets the OTHER party
 * (not the author) mark a comment as read, set a thumbs-up/down
 * reaction, or attach a short reply. The author of the comment
 * cannot ack their own comment.
 *
 * Body (all optional):
 *   { readAt: "now" | ISO string }         → sets readAt
 *   { reaction: "THUMBS_UP" | "THUMBS_DOWN" | null }
 *   { replyText: string | null }           → trimmed, capped at 40 chars
 *
 * The client can combine fields to ack + react in a single call.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { commentTargetPair, verifyCommentAccess } from "@/lib/comments/access";

const MAX_REPLY_LENGTH = 40;
const ALLOWED_REACTIONS = ["THUMBS_UP", "THUMBS_DOWN"] as const;
const SELF_DELETE_WINDOW_MS = 15 * 60 * 1000;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Load the comment and verify the current user is the recipient
    // (i.e. NOT the author). Access to the underlying target (throw,
    // session, etc.) was already verified at creation time, so if the
    // user can see the row it's theirs to ack.
    const existing = await prisma.throwComment.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
        authorRole: true,
        deletedAt: true,
        throwLogId: true,
        practiceAttemptId: true,
        trainingSessionId: true,
        throwsAssignmentId: true,
        athleteDrillLogId: true,
        videoAnalysisId: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Comment not found" }, { status: 404 });
    }
    if (existing.deletedAt) {
      return NextResponse.json(
        { success: false, error: "Cannot modify a deleted comment." },
        { status: 410 }
      );
    }
    if (existing.authorId === session.userId) {
      return NextResponse.json(
        { success: false, error: "You cannot acknowledge your own comment." },
        { status: 403 }
      );
    }

    const pair = commentTargetPair(existing);
    if (!pair) {
      return NextResponse.json(
        { success: false, error: "Comment has no valid target" },
        { status: 500 }
      );
    }
    const canAck = await verifyCommentAccess(session.userId, session.role, pair.field, pair.id);
    if (!canAck) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const updates: Record<string, unknown> = {};

    if ("readAt" in body) {
      // Accepts "now", an ISO string, or null. "now" is the canonical
      // usage; explicit ISO is only used by replay/tests.
      if (body.readAt === "now") {
        updates.readAt = new Date();
      } else if (typeof body.readAt === "string") {
        const parsed = new Date(body.readAt);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json({ success: false, error: "Invalid readAt." }, { status: 400 });
        }
        updates.readAt = parsed;
      } else if (body.readAt === null) {
        updates.readAt = null;
      }
    }

    if ("reaction" in body) {
      const r = body.reaction;
      if (r === null) {
        updates.reaction = null;
      } else if (typeof r === "string" && (ALLOWED_REACTIONS as readonly string[]).includes(r)) {
        updates.reaction = r;
      } else {
        return NextResponse.json(
          {
            success: false,
            error: `reaction must be one of ${ALLOWED_REACTIONS.join(", ")} or null`,
          },
          { status: 400 }
        );
      }
    }

    if ("replyText" in body) {
      const t = body.replyText;
      if (t === null) {
        updates.replyText = null;
      } else if (typeof t === "string") {
        const trimmed = t.trim();
        if (trimmed.length === 0) {
          updates.replyText = null;
        } else if (trimmed.length > MAX_REPLY_LENGTH) {
          return NextResponse.json(
            { success: false, error: `replyText must be ${MAX_REPLY_LENGTH} characters or fewer.` },
            { status: 400 }
          );
        } else {
          updates.replyText = trimmed;
        }
      } else {
        return NextResponse.json(
          { success: false, error: "replyText must be a string or null." },
          { status: 400 }
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: "No fields to update." }, { status: 400 });
    }

    const updated = await prisma.throwComment.update({
      where: { id },
      data: updates,
      select: {
        id: true,
        readAt: true,
        reaction: true,
        replyText: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        readAt: updated.readAt?.toISOString() ?? null,
        reaction: updated.reaction,
        replyText: updated.replyText,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    logger.error("PATCH /api/throws/comments/[id]", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to update comment." },
      { status: 500 }
    );
  }
}

/* ─── DELETE — soft-delete a comment ─────────────────────────────────────── */

/**
 * Rules:
 *   • The author may delete their own comment within the self-delete window.
 *   • A coach may moderate-delete any comment on their athletes' data at any
 *     time, regardless of authorship.
 *   • Everything else: 403.
 *
 * Soft-delete sets `deletedAt` and `deletedBy`. The row is kept so both
 * parties see a "[comment deleted]" placeholder and an audit trail exists.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.throwComment.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
        authorRole: true,
        createdAt: true,
        deletedAt: true,
        throwLogId: true,
        practiceAttemptId: true,
        trainingSessionId: true,
        throwsAssignmentId: true,
        athleteDrillLogId: true,
        videoAnalysisId: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Comment not found" }, { status: 404 });
    }
    if (existing.deletedAt) {
      return NextResponse.json(
        { success: true, data: { id: existing.id, alreadyDeleted: true } },
        { status: 200 }
      );
    }

    const pair = commentTargetPair(existing);
    if (!pair) {
      return NextResponse.json(
        { success: false, error: "Comment has no valid target" },
        { status: 500 }
      );
    }

    const isAuthor = existing.authorId === session.userId;
    const withinWindow = Date.now() - existing.createdAt.getTime() < SELF_DELETE_WINDOW_MS;
    const authorCanDelete = isAuthor && withinWindow;

    let moderatorCanDelete = false;
    if (!authorCanDelete && session.role === "COACH") {
      // Coach moderation: owns the athlete whose target this lives on.
      moderatorCanDelete = await verifyCommentAccess(
        session.userId,
        session.role,
        pair.field,
        pair.id
      );
    }

    if (!authorCanDelete && !moderatorCanDelete) {
      const reason = isAuthor
        ? "The 15-minute undo window has passed."
        : "You cannot delete this comment.";
      return NextResponse.json({ success: false, error: reason }, { status: 403 });
    }

    await prisma.throwComment.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: session.userId,
      },
    });

    return NextResponse.json({
      success: true,
      data: { id, moderated: moderatorCanDelete },
    });
  } catch (err) {
    logger.error("DELETE /api/throws/comments/[id]", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to delete comment." },
      { status: 500 }
    );
  }
}
