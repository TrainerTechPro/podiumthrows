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

const MAX_REPLY_LENGTH = 40;
const ALLOWED_REACTIONS = ["THUMBS_UP", "THUMBS_DOWN"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        throwLogId: true,
        practiceAttemptId: true,
        trainingSessionId: true,
        throwsAssignmentId: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Comment not found" }, { status: 404 });
    }
    if (existing.authorId === session.userId) {
      return NextResponse.json(
        { success: false, error: "You cannot acknowledge your own comment." },
        { status: 403 }
      );
    }

    // The recipient must be able to see the underlying target. Reuse the
    // ownership filters from the parent route — delegate via a quick
    // per-role lookup so we don't duplicate the full verifyAccess helper.
    const canAck = await verifyRecipientAccess(
      session.userId,
      session.role,
      existing
    );
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
          return NextResponse.json(
            { success: false, error: "Invalid readAt." },
            { status: 400 }
          );
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
      } else if (
        typeof r === "string" &&
        (ALLOWED_REACTIONS as readonly string[]).includes(r)
      ) {
        updates.reaction = r;
      } else {
        return NextResponse.json(
          { success: false, error: `reaction must be one of ${ALLOWED_REACTIONS.join(", ")} or null` },
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
      return NextResponse.json(
        { success: false, error: "No fields to update." },
        { status: 400 }
      );
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

/* ─── Recipient access check ────────────────────────────────────────────── */

type CommentTargetFields = {
  throwLogId: string | null;
  practiceAttemptId: string | null;
  trainingSessionId: string | null;
  throwsAssignmentId: string | null;
  authorRole: string;
};

async function verifyRecipientAccess(
  userId: string,
  role: string,
  comment: CommentTargetFields
): Promise<boolean> {
  // Coaches can ack athlete-authored comments on their athletes' work.
  if (role === "COACH") {
    const coach = await prisma.coachProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!coach) return false;
    if (comment.throwLogId) {
      const tl = await prisma.throwLog.findUnique({
        where: { id: comment.throwLogId },
        select: { athlete: { select: { coachId: true } } },
      });
      return tl?.athlete.coachId === coach.id;
    }
    if (comment.trainingSessionId) {
      const ts = await prisma.trainingSession.findUnique({
        where: { id: comment.trainingSessionId },
        select: { athlete: { select: { coachId: true } } },
      });
      return ts?.athlete.coachId === coach.id;
    }
    if (comment.practiceAttemptId) {
      const pa = await prisma.practiceAttempt.findUnique({
        where: { id: comment.practiceAttemptId },
        select: { session: { select: { coachId: true } } },
      });
      return pa?.session.coachId === coach.id;
    }
    if (comment.throwsAssignmentId) {
      const ta = await prisma.throwsAssignment.findUnique({
        where: { id: comment.throwsAssignmentId },
        select: { session: { select: { coachId: true } } },
      });
      return ta?.session.coachId === coach.id;
    }
    return false;
  }

  // Athletes can ack coach-authored comments on their own work.
  if (role === "ATHLETE") {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!athlete) return false;
    if (comment.throwLogId) {
      const tl = await prisma.throwLog.findUnique({
        where: { id: comment.throwLogId },
        select: { athleteId: true },
      });
      return tl?.athleteId === athlete.id;
    }
    if (comment.trainingSessionId) {
      const ts = await prisma.trainingSession.findUnique({
        where: { id: comment.trainingSessionId },
        select: { athleteId: true },
      });
      return ts?.athleteId === athlete.id;
    }
    if (comment.practiceAttemptId) {
      const pa = await prisma.practiceAttempt.findUnique({
        where: { id: comment.practiceAttemptId },
        select: { athleteId: true },
      });
      return pa?.athleteId === athlete.id;
    }
    if (comment.throwsAssignmentId) {
      const ta = await prisma.throwsAssignment.findUnique({
        where: { id: comment.throwsAssignmentId },
        select: { athleteId: true },
      });
      return ta?.athleteId === athlete.id;
    }
    return false;
  }

  return false;
}
