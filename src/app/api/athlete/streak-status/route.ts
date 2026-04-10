/**
 * Streak Status API — returns the athlete's current streak snapshot and
 * whether a reminder notification should fire right now.
 *
 * Used by the client-side StreakReminder component as the source of truth
 * for eligibility (never trust client clocks or stale props for firing
 * rules).
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getAthleteTimezone, startOfYesterday as startOfYesterdayTz, getLocalHour } from "@/lib/dates";

const QUIET_HOURS_START = 10; // local hour, inclusive
const QUIET_HOURS_END = 20; // local hour, exclusive
const MIN_HOURS_SINCE_LAST_THROW = 23;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        currentStreak: true,
        longestStreak: true,
        lastActivityDate: true,
      },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const lastThrow = await prisma.throwLog.findFirst({
      where: { athleteId: athlete.id },
      orderBy: { date: "desc" },
      select: { date: true },
    });

    const now = new Date();
    const lastThrowAt = lastThrow?.date ?? null;

    // Resolve athlete's local timezone for all day/hour math
    const tz = await getAthleteTimezone(athlete.id);

    // "Streak active" = they logged at least once yesterday or today (in athlete's tz)
    const startOfYesterdayUtc = startOfYesterdayTz(tz);

    const isStreakActive =
      athlete.currentStreak > 0 &&
      lastThrowAt != null &&
      lastThrowAt >= startOfYesterdayUtc;

    // Hours since last throw (for the 23h reminder gate)
    const hoursSinceLastThrow =
      lastThrowAt != null
        ? (now.getTime() - lastThrowAt.getTime()) / (1000 * 60 * 60)
        : Infinity;

    // Eligibility for firing a reminder right now (athlete's local hour)
    const currentHour = getLocalHour(tz);
    const withinQuietHours =
      currentHour >= QUIET_HOURS_START && currentHour < QUIET_HOURS_END;

    const shouldRemindNow =
      isStreakActive &&
      hoursSinceLastThrow >= MIN_HOURS_SINCE_LAST_THROW &&
      withinQuietHours;

    return NextResponse.json({
      currentStreak: athlete.currentStreak,
      longestStreak: athlete.longestStreak,
      lastActivityDate: athlete.lastActivityDate?.toISOString() ?? null,
      lastThrowAt: lastThrowAt?.toISOString() ?? null,
      isStreakActive,
      hoursSinceLastThrow: Number.isFinite(hoursSinceLastThrow)
        ? Math.round(hoursSinceLastThrow * 10) / 10
        : null,
      shouldRemindNow,
    });
  } catch (err) {
    logger.error("GET /api/athlete/streak-status", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to load streak status." },
      { status: 500 }
    );
  }
}
