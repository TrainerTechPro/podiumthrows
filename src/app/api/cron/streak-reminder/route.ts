import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { getPushPreferences } from "@/lib/push/preferences";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/streak-reminder
 * Vercel Cron — runs every hour.
 *
 * Finds athletes whose lastActivityDate is 20–24 hours ago and who still have
 * an active streak, then sends a push notification reminding them to log a
 * session before their streak breaks.
 *
 * Uses the `tag` field so a second cron run in the same window replaces the
 * prior notification rather than stacking a duplicate.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ success: false, error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    // Window: activity between 20h and 24h ago
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twentyHoursAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000);

    const athletes = await prisma.athleteProfile.findMany({
      where: {
        currentStreak: { gt: 0 },
        lastActivityDate: {
          gte: twentyFourHoursAgo,
          lte: twentyHoursAgo,
        },
      },
      select: {
        id: true,
        userId: true,
        firstName: true,
        currentStreak: true,
        lastActivityDate: true,
      },
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const athlete of athletes) {
      const prefs = await getPushPreferences(athlete.id);
      if (!prefs.streakReminder) {
        skipped++;
        continue;
      }

      const lastActivity = athlete.lastActivityDate ?? now;
      const hoursSince = Math.floor(
        (now.getTime() - lastActivity.getTime()) / (60 * 60 * 1000),
      );
      const hoursRemaining = Math.max(1, 24 - hoursSince);

      try {
        const delivered = await sendPushToUser(athlete.userId, {
          title: "🔥 Don't break your streak!",
          body: `${athlete.currentStreak} day streak ends in ~${hoursRemaining}h`,
          url: "/athlete/quick-log",
          tag: `streak-${athlete.id}`,
          data: { type: "streak_reminder", athleteId: athlete.id },
        });
        if (delivered > 0) {
          sent++;
        } else {
          // No active subscriptions — not really a failure, but not delivered
          skipped++;
        }
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
