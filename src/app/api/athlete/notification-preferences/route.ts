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
import { parseBody, NotificationPreferencesPatchSchema } from "@/lib/api-schemas";

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
    return NextResponse.json({ success: true, data: { preferences: prefs } });
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

    const parsed = await parseBody(req, NotificationPreferencesPatchSchema);
    if (parsed instanceof NextResponse) return parsed;

    // Partial merge: take incoming boolean values, otherwise keep current.
    const current = parsePrefs(athlete.notificationPreferences);

    const merged: NotificationPreferences = {
      streakReminder: {
        enabled: parsed.streakReminder?.enabled ?? current.streakReminder.enabled,
        promptDismissed:
          parsed.streakReminder?.promptDismissed ?? current.streakReminder.promptDismissed,
      },
      feedPrivacy: {
        sharePRs: parsed.feedPrivacy?.sharePRs ?? current.feedPrivacy.sharePRs,
        shareSessions: parsed.feedPrivacy?.shareSessions ?? current.feedPrivacy.shareSessions,
        shareStreaks: parsed.feedPrivacy?.shareStreaks ?? current.feedPrivacy.shareStreaks,
        shareGoals: parsed.feedPrivacy?.shareGoals ?? current.feedPrivacy.shareGoals,
      },
      haptics: {
        enabled: parsed.haptics?.enabled ?? current.haptics.enabled,
      },
    };

    await prisma.athleteProfile.update({
      where: { id: athlete.id },
      data: {
        notificationPreferences: merged as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true, data: { preferences: merged } });
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
