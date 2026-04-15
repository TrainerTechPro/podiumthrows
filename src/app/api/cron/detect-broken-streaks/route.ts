import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { notifyAthleteStreakBroken } from "@/lib/notifications";

export const maxDuration = 60;

/**
 * GET /api/cron/detect-broken-streaks
 * Vercel Cron — runs daily at 01:00 UTC.
 *
 * Finds athletes whose currentStreak > 0 but lastActivityDate is >48h
 * ago, flips their streak to 0, and fires a STREAK_BROKEN notification
 * for streaks that were meaningful (>=3 days). Short streaks lapsing
 * silently is better UX than a nag.
 *
 * The 48h threshold gives timezone buffer — a streak measured by
 * updateThrowsStreak (which uses local-timezone day keys) can legitimately
 * hold beyond 24h UTC depending on the athlete's timezone. 48h covers
 * all real-world timezones with a safety margin.
 *
 * Idempotent: re-running doesn't re-notify because currentStreak is
 * flipped to 0 in the same query window.
 */
const MIN_STREAK_FOR_NOTIFICATION = 3;
const BREAK_THRESHOLD_MS = 48 * 60 * 60 * 1000;

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
    const threshold = new Date(now.getTime() - BREAK_THRESHOLD_MS);

    const broken = await prisma.athleteProfile.findMany({
      where: {
        currentStreak: { gt: 0 },
        lastActivityDate: { lt: threshold },
      },
      take: 1000,
      select: {
        id: true,
        currentStreak: true,
      },
    });

    if (broken.length === 0) {
      return NextResponse.json({
        success: true,
        data: { broken: 0, notified: 0, timestamp: now.toISOString() },
      });
    }

    // Flip all broken streaks in a single updateMany. Note: we intentionally
    // leave lastActivityDate alone — the date still reflects when the athlete
    // last actually trained, useful for analytics and re-engagement.
    await prisma.athleteProfile.updateMany({
      where: { id: { in: broken.map((a) => a.id) } },
      data: { currentStreak: 0 },
    });

    // Only notify on meaningful streaks. Short streaks break silently.
    const toNotify = broken.filter((a) => a.currentStreak >= MIN_STREAK_FOR_NOTIFICATION);

    const settled = await Promise.allSettled(
      toNotify.map((a) => notifyAthleteStreakBroken(a.id, a.currentStreak))
    );

    const notified = settled.filter((s) => s.status === "fulfilled").length;
    const notifyFailures = settled.length - notified;
    if (notifyFailures > 0) {
      logger.error("detect-broken-streaks: some notifications failed", {
        context: "cron",
        metadata: { failures: notifyFailures, total: settled.length },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        broken: broken.length,
        notified,
        notifyFailures,
        skippedShortStreaks: broken.length - toNotify.length,
        timestamp: now.toISOString(),
      },
    });
  } catch (err) {
    logger.error("detect-broken-streaks cron error", { context: "cron", error: err });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
