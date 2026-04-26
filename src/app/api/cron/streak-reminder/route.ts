import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { getPushPreferences } from "@/lib/push/preferences";
import { logger } from "@/lib/logger";
import { getLocalDate, getLocalHour, resolveTimezone } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/streak-reminder
 * Vercel Cron — runs every hour. Each athlete is evaluated against their own
 * local clock and only paged in their personal 7pm–9pm window.
 *
 * Trigger conditions (all must hold):
 *   - currentStreak > 0
 *   - athlete's local hour is in [REMIND_HOUR_START, REMIND_HOUR_END)
 *   - last activity is not today (in athlete's local timezone)
 *   - hasn't already been pushed in this local day (tag-based dedupe)
 *
 * Copy varies by freezesAvailable: when the athlete has a freeze in the bank,
 * we offer it as a backup so the message reads as helpful rather than nagging.
 *
 * The `tag` includes the local YYYY-MM-DD so a second hourly run within the
 * same window REPLACES the existing notification rather than stacking.
 */
const REMIND_HOUR_START = 19; // 7pm local, inclusive
const REMIND_HOUR_END = 21; //   9pm local, exclusive

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Pre-filter at the DB layer to keep the per-athlete loop tight: only
    // athletes with an active streak whose last activity was at least 12h
    // ago are even worth evaluating.
    const lastActivityCutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    const athletes = await prisma.athleteProfile.findMany({
      where: {
        currentStreak: { gt: 0 },
        lastActivityDate: { lte: lastActivityCutoff },
      },
      select: {
        id: true,
        userId: true,
        firstName: true,
        currentStreak: true,
        lastActivityDate: true,
        lastFreezeUsedAt: true,
        freezesAvailable: true,
        timezone: true,
      },
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const athlete of athletes) {
      const tz = resolveTimezone(athlete.timezone);
      const localHour = getLocalHour(tz, now);
      if (localHour < REMIND_HOUR_START || localHour >= REMIND_HOUR_END) {
        skipped++;
        continue;
      }

      // Skip if today already counts (activity OR freeze)
      const todayLocal = getLocalDate(tz, now);
      const lastActivityLocal = athlete.lastActivityDate
        ? getLocalDate(tz, athlete.lastActivityDate)
        : null;
      const lastFreezeLocal = athlete.lastFreezeUsedAt
        ? getLocalDate(tz, athlete.lastFreezeUsedAt)
        : null;
      if (lastActivityLocal === todayLocal || lastFreezeLocal === todayLocal) {
        skipped++;
        continue;
      }

      const prefs = await getPushPreferences(athlete.id);
      if (!prefs.streakReminder) {
        skipped++;
        continue;
      }

      const hasFreeze = athlete.freezesAvailable > 0;
      const title = `🔥 ${athlete.currentStreak}-day streak at stake`;
      const body = hasFreeze
        ? "2 minutes to save it — log a check-in or throw, or use a freeze for a real rest day."
        : "2 minutes to save it — a check-in, a single throw, or finish a session counts.";

      try {
        const delivered = await sendPushToUser(athlete.userId, {
          title,
          body,
          url: "/athlete/quick-log",
          // Per-local-day tag means second cron run in the same window
          // replaces the notification instead of stacking.
          tag: `streak-${athlete.id}-${todayLocal}`,
          data: { type: "streak_reminder", athleteId: athlete.id },
        });
        if (delivered > 0) sent++;
        else skipped++; // no active subscriptions
      } catch (err) {
        failed++;
        logger.error("streak-reminder: push failed", {
          context: "cron",
          metadata: { athleteId: athlete.id },
          error: err,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        scanned: athletes.length,
        sent,
        skipped,
        failed,
        timestamp: now.toISOString(),
      },
    });
  } catch (err) {
    logger.error("streak-reminder cron error", { context: "cron", error: err });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
