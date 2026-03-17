import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const targetField = url.searchParams.get("targetField") as TargetField | null;
    const targetId = url.searchParams.get("targetId");

    if (!targetField || !targetId || !TARGET_FIELDS.includes(targetField)) {
      return NextResponse.json(
        { error: "targetField and targetId are required" },
        { status: 400 }
      );
    }

    // Verify the user has access to this target
    const hasAccess = await verifyAccess(session.userId, session.role, targetField, targetId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
        createdAt: c.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (err) {
    logger.error("GET /api/throws/comments", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

/* ─── POST — create a comment ────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { targetField, targetId, text } = body as Record<string, unknown>;

    if (
      typeof targetField !== "string" ||
      !TARGET_FIELDS.includes(targetField as TargetField) ||
      typeof targetId !== "string" ||
      typeof text !== "string" ||
      !text.trim()
    ) {
      return NextResponse.json(
        { error: "targetField, targetId, and text are required" },
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const comment = await prisma.throwComment.create({
      data: {
        authorId: session.userId,
        authorRole: session.role,
        [targetField]: targetId,
        body: (text as string).trim(),
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

    // Create notification for the other party
    await createCommentNotification(session.userId, session.role, targetField as TargetField, targetId, (text as string).trim());

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
          createdAt: comment.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("POST /api/throws/comments", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
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
    // Only coaches get notifications (from athlete comments)
    // Athletes see comments inline when they view their throws
    if (authorRole === "ATHLETE") {
      // Find the athlete's coach and notify them
      const athlete = await prisma.athleteProfile.findUnique({
        where: { userId: authorUserId },
        select: { id: true, coachId: true, firstName: true, lastName: true },
      });
      if (!athlete?.coachId) return;

      const preview = commentText.length > 80 ? commentText.slice(0, 77) + "..." : commentText;
      await prisma.notification.create({
        data: {
          coachId: athlete.coachId,
          athleteId: athlete.id,
          type: "QUESTIONNAIRE_COMPLETE", // reuse existing type for "athlete sent something"
          title: `${athlete.firstName} left a comment`,
          body: preview,
          metadata: JSON.stringify({ targetField, targetId, type: "throw_comment" }),
        },
      });
    }
  } catch (err) {
    // Non-fatal
    logger.error("Failed to create comment notification", { context: "throws/comments", error: err });
  }
}
