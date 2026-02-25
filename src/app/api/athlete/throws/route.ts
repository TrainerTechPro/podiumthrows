import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isValidEvent, checkAndSetPR } from "@/lib/throws";
import { awardPRAchievement } from "@/lib/achievements";
import { notifyCoachPR } from "@/lib/notifications";

/* ─── POST — log a standalone throw (outside of a session) ────────────────── */

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, coachId: true, firstName: true, lastName: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { event, implementKg, distance, isCompetition, rpe, notes, attemptNumber } =
      body as Record<string, unknown>;

    // Validate required fields
    if (!isValidEvent(event)) {
      return NextResponse.json(
        { error: "Invalid event. Must be SHOT_PUT, DISCUS, HAMMER, or JAVELIN." },
        { status: 400 }
      );
    }
    if (typeof implementKg !== "number" || implementKg <= 0) {
      return NextResponse.json(
        { error: "Implement weight must be a positive number." },
        { status: 400 }
      );
    }
    if (typeof distance !== "number" || distance <= 0) {
      return NextResponse.json(
        { error: "Distance must be a positive number." },
        { status: 400 }
      );
    }

    // Check and set PR
    const { isPersonalBest } = await checkAndSetPR(
      athlete.id,
      event,
      implementKg,
      distance
    );

    // Create throw log (no session — standalone)
    const throwLog = await prisma.throwLog.create({
      data: {
        athleteId: athlete.id,
        sessionId: null,
        event: event as never,
        implementWeight: implementKg,
        distance,
        isPersonalBest,
        isCompetition: isCompetition === true,
        rpe: typeof rpe === "number" && rpe >= 1 && rpe <= 10 ? rpe : null,
        attemptNumber: typeof attemptNumber === "number" ? attemptNumber : null,
        notes: typeof notes === "string" ? notes.trim() || null : null,
      },
      select: {
        id: true,
        event: true,
        implementWeight: true,
        distance: true,
        isPersonalBest: true,
        isCompetition: true,
        rpe: true,
        attemptNumber: true,
        date: true,
      },
    });

    // Fire-and-forget: award achievement + notify coach on new PR
    if (isPersonalBest) {
      const athleteName = `${athlete.firstName} ${athlete.lastName}`;
      void awardPRAchievement(athlete.id, event).catch(console.error);
      if (athlete.coachId) {
        void notifyCoachPR(
          athlete.coachId,
          athlete.id,
          athleteName,
          event,
          distance
        ).catch(console.error);
      }
    }

    return NextResponse.json(
      {
        throwLog: {
          ...throwLog,
          event: throwLog.event as string,
          date: throwLog.date.toISOString(),
        },
        isPersonalBest,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/athlete/throws]", err);
    return NextResponse.json(
      { error: "Failed to log throw." },
      { status: 500 }
    );
  }
}
