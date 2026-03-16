/**
 * GET /api/readiness/team
 *
 * Returns the most recent readiness check-in for every athlete on the
 * coach's roster. Coach-only endpoint.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const athletes = await prisma.athleteProfile.findMany({
      where: { coachId: coach.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        events: true,
        avatarUrl: true,
        readinessCheckIns: {
          orderBy: { date: "desc" },
          take: 1,
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
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return NextResponse.json(
      athletes.map((a) => {
        const latest = a.readinessCheckIns[0] ?? null;
        return {
          athleteId: a.id,
          firstName: a.firstName,
          lastName: a.lastName,
          events: a.events as string[],
          avatarUrl: a.avatarUrl,
          latestCheckIn: latest
            ? {
                id: latest.id,
                date: latest.date.toISOString(),
                overallScore: latest.overallScore,
                sleepQuality: latest.sleepQuality,
                sleepHours: latest.sleepHours,
                soreness: latest.soreness,
                sorenessArea: latest.sorenessArea,
                stressLevel: latest.stressLevel,
                energyMood: latest.energyMood,
                hydration: latest.hydration as string,
                injuryStatus: latest.injuryStatus as string,
                injuryNotes: latest.injuryNotes,
                notes: latest.notes,
              }
            : null,
        };
      })
    );
  } catch (err) {
    logger.error("GET /api/readiness/team", { context: "api", error: err });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
