import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { awardStreakAchievements, awardFirstCheckInAchievement } from "@/lib/achievements";
import { notifyCoachLowReadiness } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { parseBody, ReadinessCheckInSchema } from "@/lib/api-schemas";

/* ─── POST — submit readiness check-in ───────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, coachId: true, firstName: true, lastName: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const parsed = await parseBody(req, ReadinessCheckInSchema);
    if (parsed instanceof NextResponse) return parsed;
    const {
      sleepQuality,
      sleepHours,
      soreness,
      sorenessArea,
      stressLevel,
      energyMood,
      hydration,
      injuryStatus,
      injuryNotes,
      notes,
    } = parsed;

    // Prevent duplicate check-in on same day
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const existing = await prisma.readinessCheckIn.findFirst({
      where: {
        athleteId: athlete.id,
        date: { gte: startOfDay, lt: endOfDay },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You already submitted a check-in today." },
        { status: 409 }
      );
    }

    // Weighted readiness score: sleep 25% (quality 15% + hours 10%), soreness 25%, stress 20%, energy 20%, hydration 10%
    const sleepHoursScore = Math.min(10, Math.max(1, (sleepHours - 4) * 2));
    const hydrationScore = hydration === "GOOD" ? 9 : hydration === "ADEQUATE" ? 6 : 3;
    const overallScore =
      Math.round(
        (sleepQuality * 0.15 +
          sleepHoursScore * 0.1 +
          soreness * 0.25 +
          stressLevel * 0.2 +
          energyMood * 0.2 +
          hydrationScore * 0.1) *
          10
      ) / 10;

    const checkIn = await prisma.readinessCheckIn.create({
      data: {
        athleteId: athlete.id,
        overallScore,
        sleepQuality,
        sleepHours,
        soreness,
        sorenessArea: sorenessArea?.trim() || null,
        stressLevel,
        energyMood,
        hydration: hydration as never,
        injuryStatus: injuryStatus as never,
        injuryNotes: injuryNotes?.trim() || null,
        notes: notes?.trim() || null,
      },
      select: { id: true, overallScore: true, date: true },
    });

    // Update streak + fire achievement/notification side effects
    const newStreak = await updateAthleteStreak(athlete.id);
    if (newStreak > 0) {
      void awardStreakAchievements(athlete.id, newStreak).catch((err) =>
        logger.error("Async operation failed", { context: "api", error: err })
      );
    }
    void awardFirstCheckInAchievement(athlete.id).catch((err) =>
      logger.error("Async operation failed", { context: "api", error: err })
    );

    if (overallScore <= 4 && athlete.coachId) {
      const athleteName = `${athlete.firstName} ${athlete.lastName}`;
      void notifyCoachLowReadiness(athlete.coachId, athlete.id, athleteName, overallScore).catch(
        (err) => logger.error("Async operation failed", { context: "api", error: err })
      );
    }

    return NextResponse.json(
      { id: checkIn.id, overallScore: checkIn.overallScore, date: checkIn.date.toISOString() },
      { status: 201 }
    );
  } catch (err) {
    logger.error("POST /api/athlete/readiness", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to save check-in." }, { status: 500 });
  }
}

async function updateAthleteStreak(athleteId: string): Promise<number> {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterdayCheckIn = await prisma.readinessCheckIn.findFirst({
      where: {
        athleteId,
        date: { gte: yesterday, lt: today },
      },
      select: { id: true },
    });

    const athleteData = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { currentStreak: true, longestStreak: true },
    });
    if (!athleteData) return 0;

    const newStreak = yesterdayCheckIn ? athleteData.currentStreak + 1 : 1;

    await prisma.athleteProfile.update({
      where: { id: athleteId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, athleteData.longestStreak),
        lastActivityDate: new Date(),
      },
    });

    return newStreak;
  } catch {
    // Non-critical — don't fail the request
    return 0;
  }
}
