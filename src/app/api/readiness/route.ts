/**
 * POST /api/readiness
 *
 * Canonical check-in submission endpoint. Delegates to the same logic
 * as /api/athlete/readiness for backwards compatibility.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, ReadinessCheckInSchema } from "@/lib/api-schemas";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
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

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const existing = await prisma.readinessCheckIn.findFirst({
      where: { athleteId: athlete.id, date: { gte: startOfDay, lt: endOfDay } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "You already submitted a check-in today." },
        { status: 409 }
      );
    }

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

    return NextResponse.json(
      { id: checkIn.id, overallScore: checkIn.overallScore, date: checkIn.date.toISOString() },
      { status: 201 }
    );
  } catch (err) {
    logger.error("POST /api/readiness", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to save check-in." }, { status: 500 });
  }
}
