/**
 * Notification Preferences API — cross-device sync for reminder settings.
 *
 * GET returns the athlete's current notification preferences (defaults
 * applied if none are saved). POST upserts them.
 *
 * Shape persisted:
 *   { streakReminder: { enabled: boolean, promptDismissed: boolean } }
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

export type StreakReminderPrefs = {
  enabled: boolean;
  promptDismissed: boolean;
};

export type NotificationPreferences = {
  streakReminder: StreakReminderPrefs;
};

const DEFAULT_PREFS: NotificationPreferences = {
  streakReminder: {
    enabled: false,
    promptDismissed: false,
  },
};

function parsePrefs(raw: unknown): NotificationPreferences {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFS;
  const r = raw as Record<string, unknown>;
  const streakRaw =
    r.streakReminder && typeof r.streakReminder === "object"
      ? (r.streakReminder as Record<string, unknown>)
      : {};
  return {
    streakReminder: {
      enabled: streakRaw.enabled === true,
      promptDismissed: streakRaw.promptDismissed === true,
    },
  };
}

/* ─── GET ────────────────────────────────────────────────────────────────── */

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { notificationPreferences: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const prefs = parsePrefs(athlete.notificationPreferences);
    return NextResponse.json({ preferences: prefs });
  } catch (err) {
    logger.error("GET /api/athlete/notification-preferences", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to load preferences." },
      { status: 500 }
    );
  }
}

/* ─── POST (upsert) ──────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, notificationPreferences: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const incomingStreak =
      body.streakReminder && typeof body.streakReminder === "object"
        ? (body.streakReminder as Record<string, unknown>)
        : null;

    // Merge against the existing prefs so partial updates are safe
    const current = parsePrefs(athlete.notificationPreferences);
    const merged: NotificationPreferences = {
      streakReminder: {
        enabled:
          incomingStreak && typeof incomingStreak.enabled === "boolean"
            ? incomingStreak.enabled
            : current.streakReminder.enabled,
        promptDismissed:
          incomingStreak && typeof incomingStreak.promptDismissed === "boolean"
            ? incomingStreak.promptDismissed
            : current.streakReminder.promptDismissed,
      },
    };

    await prisma.athleteProfile.update({
      where: { id: athlete.id },
      data: {
        notificationPreferences: merged as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ preferences: merged });
  } catch (err) {
    logger.error("POST /api/athlete/notification-preferences", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to save preferences." },
      { status: 500 }
    );
  }
}
