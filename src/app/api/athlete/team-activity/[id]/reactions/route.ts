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
import { parseBody, TeamActivityReactionSchema } from "@/lib/api-schemas";

async function canReact(userId: string, role: string, activityId: string): Promise<boolean> {
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBody(req, TeamActivityReactionSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { emoji } = parsed;

    if (!(await canReact(session.userId, session.role, id))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Toggle: if the row already exists, delete it. Otherwise create it.
    const existing = await prisma.teamActivityReaction.findUnique({
      where: {
        activityId_userId_emoji: {
          activityId: id,
          userId: session.userId,
          emoji,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.teamActivityReaction.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({
        success: true,
        data: { state: "removed" as const, emoji },
      });
    }

    await prisma.teamActivityReaction.create({
      data: {
        activityId: id,
        userId: session.userId,
        emoji,
      },
    });
    return NextResponse.json({
      success: true,
      data: { state: "added" as const, emoji },
    });
  } catch (err) {
    logger.error("POST /api/athlete/team-activity/[id]/reactions", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to update reaction." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBody(req, TeamActivityReactionSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { emoji } = parsed;

    if (!(await canReact(session.userId, session.role, id))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    await prisma.teamActivityReaction.deleteMany({
      where: {
        activityId: id,
        userId: session.userId,
        emoji,
      },
    });

    return NextResponse.json({
      success: true,
      data: { state: "removed" as const, emoji },
    });
  } catch (err) {
    logger.error("DELETE /api/athlete/team-activity/[id]/reactions", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to remove reaction." },
      { status: 500 }
    );
  }
}
