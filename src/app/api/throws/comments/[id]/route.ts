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
import { parseBody, CommentUpdateSchema } from "@/lib/api-schemas";

const MAX_REPLY_LENGTH = 40;
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

    const parsedBody = await parseBody(req, CommentUpdateSchema);
    if (parsedBody instanceof NextResponse) return parsedBody;

    const updates: Record<string, unknown> = {};

    if (parsedBody.readAt !== undefined) {
      if (parsedBody.readAt === "now") {
        updates.readAt = new Date();
      } else if (parsedBody.readAt === null) {
        updates.readAt = null;
      } else if (typeof parsedBody.readAt === "string") {
        const parsedDate = new Date(parsedBody.readAt);
        if (isNaN(parsedDate.getTime())) {
          return NextResponse.json({ success: false, error: "Invalid readAt." }, { status: 400 });
        }
        updates.readAt = parsedDate;
      }
    }

    if (parsedBody.reaction !== undefined) {
      updates.reaction = parsedBody.reaction;
    }

    if (parsedBody.replyText !== undefined) {
      const t = parsedBody.replyText;
      if (t === null) {
        updates.replyText = null;
      } else {
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
      { success: false, error: "Couldn’t update comment." },
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
      { success: false, error: "Couldn’t delete comment." },
      { status: 500 }
    );
  }
}
