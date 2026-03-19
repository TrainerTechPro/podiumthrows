import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * GET /api/throws/past-drills?event=HAMMER
 *
 * Returns distinct drill types the current athlete has previously logged
 * for the given event, ordered by most recently used.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const event = searchParams.get("event");

    if (!event || !["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"].includes(event)) {
      return NextResponse.json({ error: "Valid event is required" }, { status: 400 });
    }

    // Find the athlete or coach profile
    const athleteProfile = session.role === "ATHLETE"
      ? await prisma.athleteProfile.findUnique({
          where: { userId: session.userId },
          select: { id: true },
        })
      : null;

    const coachProfile = session.role === "COACH"
      ? await prisma.coachProfile.findUnique({
          where: { userId: session.userId },
          select: { id: true },
        })
      : null;

    if (!athleteProfile && !coachProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const drillTypes: string[] = [];

    if (athleteProfile) {
      const logs = await prisma.athleteDrillLog.findMany({
        where: {
          session: { athleteId: athleteProfile.id, event },
        },
        select: { drillType: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });

      const seen = new Set<string>();
      for (const log of logs) {
        if (!seen.has(log.drillType)) {
          seen.add(log.drillType);
          drillTypes.push(log.drillType);
        }
      }
    } else if (coachProfile) {
      const logs = await prisma.coachDrillLog.findMany({
        where: {
          session: { coachId: coachProfile.id, event },
        },
        select: { drillType: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });

      const seen = new Set<string>();
      for (const log of logs) {
        if (!seen.has(log.drillType)) {
          seen.add(log.drillType);
          drillTypes.push(log.drillType);
        }
      }
    }

    return NextResponse.json({ success: true, data: drillTypes });
  } catch (err) {
    logger.error("GET /api/throws/past-drills", { context: "api", error: err });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
