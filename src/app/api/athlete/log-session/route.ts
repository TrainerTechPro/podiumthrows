import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/* ── GET — list athlete's self-logged sessions ── */
export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: "Athlete profile not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const event = searchParams.get("event");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const where: Record<string, unknown> = { athleteId: athlete.id };
    if (event) where.event = event;

    const sessions = await prisma.athleteThrowsSession.findMany({
      where,
      orderBy: { date: "desc" },
      take: limit,
      include: {
        drillLogs: { orderBy: { createdAt: "asc" } },
      },
    });

    return NextResponse.json({ ok: true, data: sessions });
  } catch (err) {
    logger.error("GET /api/athlete/log-session", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

/* ── POST — create a self-logged session ── */
export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: "Athlete profile not found" }, { status: 404 });
    }

    const body = await request.json();

    const {
      event,
      date,
      focus,
      notes,
      // Readiness
      sleepQuality,
      sorenessLevel,
      energyLevel,
      // Post-session feedback
      sessionRpe,
      sessionFeeling,
      techniqueRating,
      mentalFocus,
      bestPart,
      improvementArea,
      // Drills
      drills,
    } = body as {
      event: string;
      date: string;
      focus?: string;
      notes?: string;
      sleepQuality?: number;
      sorenessLevel?: number;
      energyLevel?: number;
      sessionRpe?: number;
      sessionFeeling?: string;
      techniqueRating?: number;
      mentalFocus?: number;
      bestPart?: string;
      improvementArea?: string;
      drills: {
        drillType: string;
        implementWeight?: number;
        implementWeightUnit?: string;
        implementWeightOriginal?: number;
        wireLength?: string;
        throwCount: number;
        bestMark?: number;
        notes?: string;
      }[];
    };

    if (!event || !date) {
      return NextResponse.json(
        { error: "Missing required fields: event, date" },
        { status: 400 }
      );
    }

    if (!["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"].includes(event)) {
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
    }

    const created = await prisma.athleteThrowsSession.create({
      data: {
        athleteId: athlete.id,
        event,
        date,
        focus: focus || null,
        notes: notes?.trim() || null,
        sleepQuality: sleepQuality ?? null,
        sorenessLevel: sorenessLevel ?? null,
        energyLevel: energyLevel ?? null,
        sessionRpe: sessionRpe ?? null,
        sessionFeeling: sessionFeeling || null,
        techniqueRating: techniqueRating ?? null,
        mentalFocus: mentalFocus ?? null,
        bestPart: bestPart?.trim() || null,
        improvementArea: improvementArea?.trim() || null,
        drillLogs: {
          create: (drills || []).map(
            (
              d: {
                drillType: string;
                implementWeight?: number;
                implementWeightUnit?: string;
                implementWeightOriginal?: number;
                wireLength?: string;
                throwCount: number;
                bestMark?: number;
                notes?: string;
              },
            ) => ({
              drillType: d.drillType,
              implementWeight: d.implementWeight ?? null,
              implementWeightUnit: d.implementWeightUnit ?? "kg",
              implementWeightOriginal: d.implementWeightOriginal ?? null,
              wireLength: d.wireLength ?? null,
              throwCount: d.throwCount || 0,
              bestMark: d.bestMark ?? null,
              notes: d.notes?.trim() || null,
            })
          ),
        },
      },
      include: {
        drillLogs: true,
      },
    });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/athlete/log-session", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
