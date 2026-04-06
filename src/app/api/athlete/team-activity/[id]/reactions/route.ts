/**
 * Team Activity reactions
 *
 * POST   /api/athlete/team-activity/[id]/reactions — toggle an emoji
 * DELETE /api/athlete/team-activity/[id]/reactions — remove an emoji
 *
 * POST body: { emoji: "fire" | "lift" | "hundred" }
 *   - If the user already has this emoji on this activity → DELETE (toggle off)
 *   - Otherwise → INSERT (toggle on)
 * DELETE body: { emoji } — explicit remove, idempotent
 *
 * Access control: the user must be able to see the activity they're
 * reacting to. For athletes, that means their coach owns the activity
 * (same "team"). For coaches, that means they own the coachId on the
 * activity row. Both roles can react to their own team's activities.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

const ALLOWED_EMOJIS = ["fire", "lift", "hundred"] as const;
type Emoji = (typeof ALLOWED_EMOJIS)[number];

function isValidEmoji(value: unknown): value is Emoji {
  return (
    typeof value === "string" && (ALLOWED_EMOJIS as readonly string[]).includes(value)
  );
}

async function canReact(
  userId: string,
  role: string,
  activityId: string
): Promise<boolean> {
  const activity = await prisma.teamActivity.findUnique({
    where: { id: activityId },
    select: { coachId: true },
  });
  if (!activity) return false;

  if (role === "COACH") {
    const coach = await prisma.coachProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return coach?.id === activity.coachId;
  }

  if (role === "ATHLETE") {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId },
      select: { coachId: true },
    });
    return athlete?.coachId === activity.coachId;
  }

  return false;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!isValidEmoji(body.emoji)) {
      return NextResponse.json(
        { error: `emoji must be one of ${ALLOWED_EMOJIS.join(", ")}` },
        { status: 400 }
      );
    }

    if (!(await canReact(session.userId, session.role, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Toggle: if the row already exists, delete it. Otherwise create it.
    const existing = await prisma.teamActivityReaction.findUnique({
      where: {
        activityId_userId_emoji: {
          activityId: params.id,
          userId: session.userId,
          emoji: body.emoji,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.teamActivityReaction.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({ state: "removed", emoji: body.emoji });
    }

    await prisma.teamActivityReaction.create({
      data: {
        activityId: params.id,
        userId: session.userId,
        emoji: body.emoji,
      },
    });
    return NextResponse.json({ state: "added", emoji: body.emoji });
  } catch (err) {
    logger.error("POST /api/athlete/team-activity/[id]/reactions", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to update reaction." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!isValidEmoji(body.emoji)) {
      return NextResponse.json(
        { error: `emoji must be one of ${ALLOWED_EMOJIS.join(", ")}` },
        { status: 400 }
      );
    }

    if (!(await canReact(session.userId, session.role, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.teamActivityReaction.deleteMany({
      where: {
        activityId: params.id,
        userId: session.userId,
        emoji: body.emoji,
      },
    });

    return NextResponse.json({ state: "removed", emoji: body.emoji });
  } catch (err) {
    logger.error("DELETE /api/athlete/team-activity/[id]/reactions", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to remove reaction." },
      { status: 500 }
    );
  }
}
