/**
 * /api/coach/notification-preferences
 *
 * GET  — Returns the coach's parsed prefs (defaults applied).
 * POST — Partial-merge upsert. Send only the keys you want to change.
 *
 * Body shape (POST):
 *   { inApp?: { PR_ALERT?: boolean, LOW_READINESS?: boolean, ... } }
 *
 * Response envelope follows the canonical { success, data | error } shape.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  COACH_NOTIFICATION_TYPES,
  parseCoachPrefs,
  type CoachNotificationPreferences,
  type CoachNotificationType,
} from "@/lib/notifications/coach-preferences";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: user.userId },
      select: { notificationPreferences: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const preferences = parseCoachPrefs(coach.notificationPreferences);
    return NextResponse.json({ success: true, data: { preferences } });
  } catch (err) {
    logger.error("GET /api/coach/notification-preferences", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to load preferences." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true, notificationPreferences: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const incomingInApp =
      body.inApp && typeof body.inApp === "object" ? (body.inApp as Record<string, unknown>) : null;

    const current = parseCoachPrefs(coach.notificationPreferences);
    const mergedInApp = { ...current.inApp };
    if (incomingInApp) {
      for (const type of COACH_NOTIFICATION_TYPES) {
        const val = incomingInApp[type];
        if (typeof val === "boolean") {
          mergedInApp[type as CoachNotificationType] = val;
        }
      }
    }

    const merged: CoachNotificationPreferences = { inApp: mergedInApp };

    await prisma.coachProfile.update({
      where: { id: coach.id },
      data: {
        notificationPreferences: merged as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true, data: { preferences: merged } });
  } catch (err) {
    logger.error("POST /api/coach/notification-preferences", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to save preferences." },
      { status: 500 }
    );
  }
}
