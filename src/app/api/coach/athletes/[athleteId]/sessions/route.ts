import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, CoachAthleteSessionCreateSchema } from "@/lib/api-schemas";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { athleteId } = await params;

    // Verify athlete belongs to this coach
    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const athlete = await prisma.athleteProfile.findFirst({
      where: { id: athleteId, coachId: coach.id },
      select: { id: true, events: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const parsed = await parseBody(request, CoachAthleteSessionCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { event, date, drillLogs } = parsed;

    // Validate event is in athlete's events
    if (!(athlete.events as string[]).includes(event)) {
      return NextResponse.json(
        { success: false, error: `Invalid event. Athlete trains: ${athlete.events.join(", ")}` },
        { status: 400 }
      );
    }

    // Create session with drill logs (limited — no readiness/feedback)
    const athleteSession = await prisma.athleteThrowsSession.create({
      data: {
        athleteId,
        event: event as "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN",
        date,
        loggedByCoach: true,
        drillLogs: {
          create: drillLogs.map((drill) => ({
            drillType: drill.drillType,
            implementWeight: drill.implementWeight ?? null,
            throwCount: drill.throwCount ?? 0,
            bestMark: drill.bestMark ?? null,
            notes: drill.notes ?? null,
          })),
        },
      },
      include: { drillLogs: true },
    });

    return NextResponse.json({ success: true, data: athleteSession }, { status: 201 });
  } catch (error) {
    logger.error("Error logging session for athlete", { context: "api", error });
    return NextResponse.json({ success: false, error: "Failed to log session" }, { status: 500 });
  }
}
