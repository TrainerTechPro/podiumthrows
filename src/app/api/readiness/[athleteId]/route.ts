/**
 * GET /api/readiness/[athleteId]
 *
 * Returns check-in history for an athlete.
 * - Coaches can access any athlete on their roster.
 * - Athletes can access their own history.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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

      const athleteOnRoster = await prisma.athleteProfile.findFirst({
        where: { id: athleteId, coachId: coach.id },
        select: { id: true },
      });
      if (!athleteOnRoster) {
        return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
      }
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

    const checkIns = await prisma.readinessCheckIn.findMany({
      where: { athleteId },
      orderBy: { date: "desc" },
      take: 30,
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

    return NextResponse.json(
      checkIns.map((c) => ({
        id: c.id,
        date: c.date.toISOString(),
        overallScore: c.overallScore,
        sleepQuality: c.sleepQuality,
        sleepHours: c.sleepHours,
        soreness: c.soreness,
        sorenessArea: c.sorenessArea,
        stressLevel: c.stressLevel,
        energyMood: c.energyMood,
        hydration: c.hydration as string,
        injuryStatus: c.injuryStatus as string,
        injuryNotes: c.injuryNotes,
        notes: c.notes,
      }))
    );
  } catch (err) {
    console.error("[GET /api/readiness/:athleteId]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
