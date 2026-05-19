/**
 * POST /api/coach/team-activity
 *
 * Lets an authenticated coach post a team-wide message that appears
 * in the athlete feed. Inserts a TeamActivity row with type COACH_POST
 * and athleteId null. The body is capped at a reasonable length — the
 * feed is for short motivational posts, not essays.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emitCoachPost } from "@/lib/team-activity";
import { logger } from "@/lib/logger";

const MAX_POST_LENGTH = 500;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Only coaches acting as coaches can post. A coach toggled into
    // training mode (canActAsAthlete returns true for that state) is
    // treated as an athlete here — we don't want coach posts to come
    // from an athlete-mode identity.
    if (session.role !== "COACH" || (await canActAsAthlete(session))) {
      return NextResponse.json(
        { success: false, error: "Only coaches can post team messages." },
        { status: 403 }
      );
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found." }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const rawText = body.body;
    if (typeof rawText !== "string") {
      return NextResponse.json(
        { success: false, error: "body is required and must be a string." },
        { status: 400 }
      );
    }
    const trimmed = rawText.trim();
    if (trimmed.length === 0) {
      return NextResponse.json(
        { success: false, error: "Post cannot be empty." },
        { status: 400 }
      );
    }
    if (trimmed.length > MAX_POST_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: `Post too long (max ${MAX_POST_LENGTH} characters).`,
        },
        { status: 400 }
      );
    }

    await emitCoachPost(coach.id, { body: trimmed });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("POST /api/coach/team-activity", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Couldn’t create post." },
      { status: 500 }
    );
  }
}
