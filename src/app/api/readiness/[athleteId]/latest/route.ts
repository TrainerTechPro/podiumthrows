/**
 * GET /api/readiness/[athleteId]/latest
 *
 * Returns the most recent readiness check-in for an athlete.
 * Access: coach (for roster athletes) or the athlete themselves.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { athleteId } = await params;

    if (session.role === "COACH") {
      const coach = await prisma.coachProfile.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      });
      if (!coach) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const onRoster = await prisma.athleteProfile.findFirst({
        where: { id: athleteId, coachId: coach.id },
        select: { id: true },
      });
      if (!onRoster) return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    } else if (session.role === "ATHLETE") {
      const athlete = await prisma.athleteProfile.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      });
      if (!athlete || athlete.id !== athleteId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const checkIn = await prisma.readinessCheckIn.findFirst({
      where: { athleteId },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        overallScore: true,
        sleepQuality: true,
        sleepHours: true,
        soreness: true,
        sorenessArea: true,
        stressLevel: true,
        energyMood: true,
        hydration: true,
        injuryStatus: true,
        injuryNotes: true,
        notes: true,
      },
    });

    if (!checkIn) return NextResponse.json(null);

    return NextResponse.json({
      id: checkIn.id,
      date: checkIn.date.toISOString(),
      overallScore: checkIn.overallScore,
      sleepQuality: checkIn.sleepQuality,
      sleepHours: checkIn.sleepHours,
      soreness: checkIn.soreness,
      sorenessArea: checkIn.sorenessArea,
      stressLevel: checkIn.stressLevel,
      energyMood: checkIn.energyMood,
      hydration: checkIn.hydration as string,
      injuryStatus: checkIn.injuryStatus as string,
      injuryNotes: checkIn.injuryNotes,
      notes: checkIn.notes,
    });
  } catch (err) {
    logger.error("GET /api/readiness/:athleteId/latest", { context: "api", error: err });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
