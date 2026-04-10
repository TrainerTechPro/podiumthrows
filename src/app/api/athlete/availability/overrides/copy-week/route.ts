import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * POST /api/athlete/availability/overrides/copy-week
 *
 * Copies all AvailabilityOverride records from the current week (Mon–Sun)
 * forward by 7 days, creating equivalent overrides for next week.
 * Skips duplicates where a record already exists for the target date.
 *
 * Returns: { created: number }
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    // Compute Mon–Sun bounds for the current week (local wall-clock dates).
    // We work in YYYY-MM-DD strings throughout — no timezone math needed.
    const now = new Date();
    const todayDow = now.getDay(); // 0=Sun…6=Sat
    // Distance back to Monday (0 on Mon, 6 on Sun)
    const daysToMon = todayDow === 0 ? 6 : todayDow - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysToMon);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const weekStart = fmt(monday);
    const weekEnd = fmt(sunday);

    // Fetch all overrides for this week
    const thisWeekOverrides = await prisma.availabilityOverride.findMany({
      where: {
        athleteId: athlete.id,
        date: { gte: weekStart, lte: weekEnd },
      },
    });

    if (thisWeekOverrides.length === 0) {
      return NextResponse.json({ success: true, created: 0 });
    }

    // Compute target dates (+7 days) and find which ones already exist
    const targetDates = thisWeekOverrides.map((o) => {
      const [y, m, d] = o.date.split("-").map(Number);
      const target = new Date(y, m - 1, d + 7);
      return fmt(target);
    });

    const existing = await prisma.availabilityOverride.findMany({
      where: {
        athleteId: athlete.id,
        date: { in: targetDates },
      },
      select: { date: true },
    });
    const existingDates = new Set(existing.map((e) => e.date));

    // Create overrides that don't already exist
    const toCreate = thisWeekOverrides
      .map((o, i) => ({ override: o, targetDate: targetDates[i] }))
      .filter(({ targetDate }) => !existingDates.has(targetDate));

    if (toCreate.length > 0) {
      await prisma.availabilityOverride.createMany({
        data: toCreate.map(({ override, targetDate }) => ({
          athleteId: athlete.id,
          date: targetDate,
          startTime: override.startTime,
          endTime: override.endTime,
          type: override.type,
          reason: override.reason,
        })),
      });
    }

    return NextResponse.json({ success: true, created: toCreate.length });
  } catch (err) {
    logger.error("POST /api/athlete/availability/overrides/copy-week", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to copy overrides." },
      { status: 500 }
    );
  }
}
