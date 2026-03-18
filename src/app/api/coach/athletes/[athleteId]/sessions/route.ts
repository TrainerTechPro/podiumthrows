import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { athleteId } = await params;

    // Verify athlete belongs to this coach
    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const athlete = await prisma.athleteProfile.findFirst({
      where: { id: athleteId, coachId: coach.id },
      select: { id: true, events: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const body = await request.json();
    const { event, date, drillLogs } = body;

    // Validate event is in athlete's events
    if (!event || !athlete.events.includes(event)) {
      return NextResponse.json(
        { error: `Invalid event. Athlete trains: ${athlete.events.join(", ")}` },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    if (!Array.isArray(drillLogs) || drillLogs.length === 0) {
      return NextResponse.json({ error: "At least one drill log is required" }, { status: 400 });
    }

    // Create session with drill logs (limited — no readiness/feedback)
    const athleteSession = await prisma.athleteThrowsSession.create({
      data: {
        athleteId,
        event,
        date,
        loggedByCoach: true,
        drillLogs: {
          create: drillLogs.map((drill: { drillType: string; implementWeight?: number; throwCount?: number; bestMark?: number; notes?: string }) => ({
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

    return NextResponse.json({ ok: true, data: athleteSession }, { status: 201 });
  } catch (error) {
    console.error("Error logging session for athlete:", error);
    return NextResponse.json({ error: "Failed to log session" }, { status: 500 });
  }
}
