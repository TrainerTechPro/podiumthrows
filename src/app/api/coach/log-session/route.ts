import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { checkAndSetCoachPR } from "@/lib/coach-throws";
import { validateImplementSequence, type BondarchukWarning, type BlockInput } from "@/lib/bondarchuk";

/* ── GET — list coach's self-logged sessions ── */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach profile not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const event = searchParams.get("event");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const where: Record<string, unknown> = { coachId: coach.id };
    if (event) where.event = event;

    const sessions = await prisma.coachThrowsSession.findMany({
      where,
      orderBy: { date: "desc" },
      take: limit,
      include: { drillLogs: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json({ ok: true, data: sessions });
  } catch (err) {
    logger.error("GET /api/coach/log-session", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

/* ── POST — create a coach self-logged session ── */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      event, date, focus, notes,
      sleepQuality, sorenessLevel, energyLevel,
      sessionRpe, sessionFeeling, techniqueRating, mentalFocus,
      bestPart, improvementArea,
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
      return NextResponse.json({ error: "Missing required fields: event, date" }, { status: 400 });
    }

    if (!["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"].includes(event)) {
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
    }

    const created = await prisma.coachThrowsSession.create({
      data: {
        coachId: coach.id,
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
            (d: {
              drillType: string;
              implementWeight?: number;
              implementWeightUnit?: string;
              implementWeightOriginal?: number;
              wireLength?: string;
              throwCount: number;
              bestMark?: number;
              notes?: string;
            }) => ({
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
      include: { drillLogs: true },
    });

    // PR detection: check each drill with implementWeight + bestMark > 0
    type PRResult = { event: string; implement: string; distance: number; previousBest?: number };
    const prs: PRResult[] = [];
    for (const dl of created.drillLogs) {
      if (dl.implementWeight && dl.bestMark && dl.bestMark > 0) {
        const result = await checkAndSetCoachPR(
          coach.id,
          event,
          dl.implementWeight,
          dl.bestMark,
          new Date(date),
          created.id,
          dl.drillType,
        );
        if (result.isPersonalBest) {
          prs.push({
            event,
            implement: dl.implementWeightOriginal
              ? `${dl.implementWeightOriginal}${dl.implementWeightUnit ?? "kg"}`
              : `${dl.implementWeight}kg`,
            distance: dl.bestMark,
            previousBest: result.previousBest,
          });
        }
      }
    }

    // Bondarchuk validation (competitive mode only)
    let warnings: BondarchukWarning[] = [];
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { id: coach.id },
      select: { preferences: true },
    });
    const prefs = JSON.parse(coachProfile?.preferences || "{}");
    if (prefs.myTraining?.mode === "competitive") {
      const throwingBlock: BlockInput = {
        name: "Throws",
        blockType: "throwing",
        exercises: (drills || [])
          .filter((d: { implementWeight?: number }) => d.implementWeight)
          .map((d: { drillType: string; implementWeight?: number }) => ({
            name: d.drillType,
            implementKg: d.implementWeight,
          })),
      };
      if (throwingBlock.exercises.length > 1) {
        const result = validateImplementSequence([throwingBlock]);
        warnings = result.warnings;
      }
    }

    return NextResponse.json({ ok: true, data: created, prs, warnings }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/coach/log-session", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
