/**
 * Notify Coach — athlete taps "Send to coach" from the recap screen.
 * Creates a Notification row for the athlete's coach with a summary of
 * the session (throw count, best throw, PR count).
 *
 * Idempotent per session: if a WORKOUT_COMPLETED notification for this
 * session already exists, we return it rather than creating a duplicate.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { formatEventType } from "@/lib/utils";
import { logger } from "@/lib/logger";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        coachId: true,
      },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const trainingSession = await prisma.trainingSession.findFirst({
      where: { id: sessionId, athleteId: athlete.id },
      select: {
        id: true,
        completedDate: true,
        throwLogs: {
          select: { distance: true, event: true, isPersonalBest: true, implementWeight: true },
        },
      },
    });

    if (!trainingSession) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    // Idempotency — look for an existing notification for this session
    // We scope by coachId + type + metadata.sessionId
    const existing = await prisma.notification.findFirst({
      where: {
        coachId: athlete.coachId,
        type: "WORKOUT_COMPLETED",
        metadata: { path: ["sessionId"], equals: sessionId },
      },
      select: { id: true, createdAt: true },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadySent: true,
        notificationId: existing.id,
        sentAt: existing.createdAt.toISOString(),
      });
    }

    // Compute summary fields for the notification body
    type ThrowRow = typeof trainingSession.throwLogs[number];
    const totalThrows = trainingSession.throwLogs.length;
    const bestThrow = trainingSession.throwLogs.reduce<ThrowRow | null>((best, t) => {
      if (t.distance == null) return best;
      if (best == null) return t;
      return t.distance > (best.distance ?? 0) ? t : best;
    }, null);
    const prCount = trainingSession.throwLogs.filter((t) => t.isPersonalBest).length;

    const athleteName = `${athlete.firstName} ${athlete.lastName}`.trim();

    const bodyParts: string[] = [`${totalThrows} throw${totalThrows === 1 ? "" : "s"}`];
    if (bestThrow && bestThrow.distance != null) {
      bodyParts.push(
        `best ${bestThrow.distance.toFixed(2)}m ${formatEventType(bestThrow.event)}`
      );
    }
    if (prCount > 0) {
      bodyParts.push(`${prCount} PR${prCount === 1 ? "" : "s"}`);
    }

    await createNotification({
      type: "WORKOUT_COMPLETED",
      coachId: athlete.coachId,
      athleteProfileId: athlete.id,
      title: `${athleteName} finished a session`,
      body: bodyParts.join(" · "),
      metadata: {
        sessionId: sessionId,
        totalThrows,
        bestDistance: bestThrow?.distance ?? null,
        bestEvent: (bestThrow?.event as string | undefined) ?? null,
        prCount,
        athleteName,
        link: `/coach/athletes/${athlete.id}/sessions/${sessionId}`,
      },
    });

    return NextResponse.json({
      success: true,
      alreadySent: false,
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("POST /api/athlete/session-recap/[sessionId]/notify-coach", {
      context: "api",
      error: err,
    });
    return NextResponse.json({ success: false, error: "Failed to notify coach." }, { status: 500 });
  }
}
