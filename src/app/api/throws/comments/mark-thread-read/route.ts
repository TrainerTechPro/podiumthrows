/**
 * POST /api/throws/comments/mark-thread-read
 *
 * Marks every comment on a given (targetField, targetId) as read for the
 * current user, but only when authored by the OTHER role (you cannot mark
 * your own comments as read, by definition). Idempotent.
 *
 * Body: { targetField: TargetField, targetId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { isTargetField, verifyCommentAccess } from "@/lib/comments/access";
import { parseBody, MarkThreadReadSchema } from "@/lib/api-schemas";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBody(req, MarkThreadReadSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { targetField, targetId } = parsed;

    if (!isTargetField(targetField)) {
      return NextResponse.json({ success: false, error: "Invalid targetField." }, { status: 400 });
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

    const otherRole = session.role === "COACH" ? "ATHLETE" : "COACH";

    const result = await prisma.throwComment.updateMany({
      where: {
        [targetField]: targetId,
        authorRole: otherRole,
        readAt: null,
        deletedAt: null,
      } as Parameters<typeof prisma.throwComment.updateMany>[0]["where"],
      data: { readAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: { marked: result.count },
    });
  } catch (err) {
    logger.error("POST /api/throws/comments/mark-thread-read", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Couldn’t mark thread as read" },
      { status: 500 }
    );
  }
}
