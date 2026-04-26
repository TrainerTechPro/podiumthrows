/**
 * GET /api/athlete/streak/history
 *
 * Returns a chronological 30-day streak history for the authenticated athlete:
 * one entry per day in the athlete's local timezone, marked active / frozen /
 * inactive. Powers the dashboard streak detail sheet.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAthleteTimezone, getLocalDate } from "@/lib/dates";

const HISTORY_DAYS = 30;

type DayKind = "active" | "frozen" | "inactive";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        currentStreak: true,
        longestStreak: true,
        freezesAvailable: true,
        lastFreezeUsedAt: true,
      },
    });
    if (!athlete) {
      return NextResponse.json(
        { success: false, error: "Athlete profile not found" },
        { status: 404 }
      );
    }

    const tz = await getAthleteTimezone(athlete.id);
    const now = new Date();
    const lookbackStart = new Date(now);
    lookbackStart.setDate(lookbackStart.getDate() - HISTORY_DAYS);
    const lookbackYmd = getLocalDate(tz, lookbackStart);

    const [throws, sessions, assignments, selfLogged] = await Promise.all([
      prisma.throwLog.findMany({
        where: { athleteId: athlete.id, date: { gte: lookbackStart } },
        select: { date: true },
      }),
      prisma.trainingSession.findMany({
        where: {
          athleteId: athlete.id,
          status: "COMPLETED",
          completedDate: { gte: lookbackStart },
        },
        select: { completedDate: true },
      }),
      prisma.throwsAssignment.findMany({
        where: {
          athleteId: athlete.id,
          status: { in: ["COMPLETED", "PARTIAL"] },
          completedAt: { gte: lookbackStart },
        },
        select: { completedAt: true },
      }),
      prisma.athleteThrowsSession.findMany({
        where: { athleteId: athlete.id, date: { gte: lookbackYmd } },
        select: { date: true },
      }),
    ]);

    const activeDays = new Set<string>();
    for (const t of throws) activeDays.add(getLocalDate(tz, t.date));
    for (const s of sessions) {
      if (s.completedDate) activeDays.add(getLocalDate(tz, s.completedDate));
    }
    for (const a of assignments) {
      if (a.completedAt) activeDays.add(getLocalDate(tz, a.completedAt));
    }
    for (const s of selfLogged) {
      if (typeof s.date === "string") activeDays.add(s.date);
    }

    const frozenDay = athlete.lastFreezeUsedAt ? getLocalDate(tz, athlete.lastFreezeUsedAt) : null;

    const days: { date: string; kind: DayKind }[] = [];
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ymd = getLocalDate(tz, d);
      let kind: DayKind = "inactive";
      if (activeDays.has(ymd)) kind = "active";
      else if (frozenDay === ymd) kind = "frozen";
      days.push({ date: ymd, kind });
    }

    return NextResponse.json({
      success: true,
      data: {
        currentStreak: athlete.currentStreak,
        longestStreak: athlete.longestStreak,
        freezesAvailable: athlete.freezesAvailable,
        days,
      },
    });
  } catch (err) {
    logger.error("GET /api/athlete/streak/history", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to load streak history." },
      { status: 500 }
    );
  }
}
