/**
 * Notification Preferences API — cross-device sync for reminder settings
 * and team feed privacy flags.
 *
 * GET returns the athlete's current notification preferences (defaults
 * applied if none are saved). POST upserts them with partial-merge
 * semantics — send only the keys you want to change.
 *
 * Shape persisted:
 *   {
 *     streakReminder: { enabled, promptDismissed },
 *     feedPrivacy:    { sharePRs, shareSessions, shareStreaks, shareGoals }
 *   }
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

export type FeedPrivacyPrefs = {
  sharePRs: boolean;
  shareSessions: boolean;
  shareStreaks: boolean;
  shareGoals: boolean;
};

export type HapticsPrefs = {
  /** Master haptic switch. Default ON — athletes opt out, not in. */
  enabled: boolean;
};

export type NotificationPreferences = {
  streakReminder: StreakReminderPrefs;
  feedPrivacy: FeedPrivacyPrefs;
  haptics: HapticsPrefs;
};

const DEFAULT_PREFS: NotificationPreferences = {
  streakReminder: {
    enabled: false,
    promptDismissed: false,
  },
  feedPrivacy: {
    // Defaults favor sharing — opt-out model, not opt-in. Athletes must
    // explicitly disable sharing to hide activity from their teammates.
    sharePRs: true,
    shareSessions: true,
    shareStreaks: true,
    shareGoals: true,
  },
  haptics: {
    enabled: true,
  },
};

function parsePrefs(raw: unknown): NotificationPreferences {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFS;
  const r = raw as Record<string, unknown>;

  const streakRaw =
    r.streakReminder && typeof r.streakReminder === "object"
      ? (r.streakReminder as Record<string, unknown>)
      : {};

  const feedRaw =
    r.feedPrivacy && typeof r.feedPrivacy === "object"
      ? (r.feedPrivacy as Record<string, unknown>)
      : {};

  const hapticsRaw =
    r.haptics && typeof r.haptics === "object" ? (r.haptics as Record<string, unknown>) : {};

  return {
    streakReminder: {
      enabled: streakRaw.enabled === true,
      promptDismissed: streakRaw.promptDismissed === true,
    },
    feedPrivacy: {
      // Defaults favor sharing — only false when explicitly set to false.
      sharePRs: feedRaw.sharePRs !== false,
      shareSessions: feedRaw.shareSessions !== false,
      shareStreaks: feedRaw.shareStreaks !== false,
      shareGoals: feedRaw.shareGoals !== false,
    },
    haptics: {
      // Default ON — only false when explicitly set to false.
      enabled: hapticsRaw.enabled !== false,
    },
  };
}

/* ─── GET ────────────────────────────────────────────────────────────────── */

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { notificationPreferences: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const prefs = parsePrefs(athlete.notificationPreferences);
    // eslint-disable-next-line no-restricted-syntax -- TODO(HIGH-03-follow-up): migrate to { success: true, data } envelope
    return NextResponse.json({ preferences: prefs });
  } catch (err) {
    logger.error("GET /api/athlete/notification-preferences", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to load preferences." },
      { status: 500 }
    );
  }
}

/* ─── POST (upsert with partial merge) ───────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, notificationPreferences: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const incomingStreak =
      body.streakReminder && typeof body.streakReminder === "object"
        ? (body.streakReminder as Record<string, unknown>)
        : null;

    const incomingFeed =
      body.feedPrivacy && typeof body.feedPrivacy === "object"
        ? (body.feedPrivacy as Record<string, unknown>)
        : null;

    const incomingHaptics =
      body.haptics && typeof body.haptics === "object"
        ? (body.haptics as Record<string, unknown>)
        : null;

    // Partial merge: for each key, take the incoming value if it's a
    // boolean, otherwise keep the current value. Unknown keys on the
    // input are ignored.
    const current = parsePrefs(athlete.notificationPreferences);

    const pickBool = (
      incoming: Record<string, unknown> | null,
      key: string,
      fallback: boolean
    ): boolean => {
      if (incoming && typeof incoming[key] === "boolean") {
        return incoming[key] as boolean;
      }
      return fallback;
    };

    const merged: NotificationPreferences = {
      streakReminder: {
        enabled: pickBool(incomingStreak, "enabled", current.streakReminder.enabled),
        promptDismissed: pickBool(
          incomingStreak,
          "promptDismissed",
          current.streakReminder.promptDismissed
        ),
      },
      feedPrivacy: {
        sharePRs: pickBool(incomingFeed, "sharePRs", current.feedPrivacy.sharePRs),
        shareSessions: pickBool(incomingFeed, "shareSessions", current.feedPrivacy.shareSessions),
        shareStreaks: pickBool(incomingFeed, "shareStreaks", current.feedPrivacy.shareStreaks),
        shareGoals: pickBool(incomingFeed, "shareGoals", current.feedPrivacy.shareGoals),
      },
      haptics: {
        enabled: pickBool(incomingHaptics, "enabled", current.haptics.enabled),
      },
    };

    await prisma.athleteProfile.update({
      where: { id: athlete.id },
      data: {
        notificationPreferences: merged as unknown as Prisma.InputJsonValue,
      },
    });

    // eslint-disable-next-line no-restricted-syntax -- TODO(HIGH-03-follow-up): migrate to { success: true, data } envelope
    return NextResponse.json({ preferences: merged });
  } catch (err) {
    logger.error("POST /api/athlete/notification-preferences", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to save preferences." },
      { status: 500 }
    );
  }
}
