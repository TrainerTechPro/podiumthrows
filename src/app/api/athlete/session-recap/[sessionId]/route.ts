/**
 * Session Recap API — returns everything the post-session recap screen needs
 * in a single round-trip.
 *
 * The heavy lifting lives in `src/lib/data/session-recap.ts` so both this
 * endpoint and the athlete recap server page can use the same computation.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { computeSessionRecap } from "@/lib/data/session-recap";
import { logger } from "@/lib/logger";

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const recap = await computeSessionRecap(athlete.id, params.sessionId);
    if (!recap) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(recap);
  } catch (err) {
    logger.error("GET /api/athlete/session-recap/[sessionId]", {
      context: "api",
      error: err,
    });
    return NextResponse.json({ error: "Failed to load recap." }, { status: 500 });
  }
}
