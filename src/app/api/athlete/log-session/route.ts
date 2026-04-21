import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, LogSessionSchema } from "@/lib/api-schemas";
import {
  validateImplementSequence,
  type BondarchukWarning,
  type BlockInput,
} from "@/lib/bondarchuk";
import { recordThrow } from "@/lib/throws/pr";
import { EventType } from "@prisma/client";

/* ── GET — list athlete's self-logged sessions ── */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, coachId: true },
    });
    if (!athlete) {
      return NextResponse.json(
        { success: false, error: "Athlete profile not found" },
        { status: 404 }
      );
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

    return NextResponse.json({ success: true, data: sessions });
  } catch (err) {
    logger.error("GET /api/athlete/log-session", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

/* ── POST — create a self-logged session ── */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, coachId: true },
    });
    if (!athlete) {
      return NextResponse.json(
        { success: false, error: "Athlete profile not found" },
        { status: 404 }
      );
    }

    const parsed = await parseBody(request, LogSessionSchema);
    if (parsed instanceof NextResponse) return parsed;
    const {
      event,
      date,
      focus,
      notes,
      sleepQuality,
      sorenessLevel,
      energyLevel,
      sessionRpe,
      sessionFeeling,
      techniqueRating,
      mentalFocus,
      bestPart,
      improvementArea,
      drills,
    } = parsed as {
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
        bestMarkUnit?: "meters" | "feet";
        bestMarkOriginal?: number;
        notes?: string;
      }[];
    };

    if (!event || !date) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: event, date" },
        { status: 400 }
      );
    }

    if (!["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"].includes(event)) {
      return NextResponse.json({ success: false, error: "Invalid event type" }, { status: 400 });
    }

    const created = await prisma.athleteThrowsSession.create({
      data: {
        athleteId: athlete.id,
        event: event as EventType,
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
              bestMarkUnit?: "meters" | "feet";
              bestMarkOriginal?: number;
              notes?: string;
            }) => ({
              drillType: d.drillType,
              implementWeight: d.implementWeight ?? null,
              implementWeightUnit: d.implementWeightUnit ?? "kg",
              implementWeightOriginal: d.implementWeightOriginal ?? null,
              wireLength: d.wireLength ?? null,
              throwCount: d.throwCount || 0,
              bestMark: d.bestMark ?? null,
              bestMarkUnit: d.bestMarkUnit ?? "meters",
              bestMarkOriginal: d.bestMarkOriginal ?? null,
              notes: d.notes?.trim() || null,
            })
          ),
        },
      },
      include: {
        drillLogs: true,
      },
    });

    // Invalidate caches for this athlete and their coach
    revalidateTag(`athlete-${athlete.id}`);
    if (athlete.coachId) revalidateTag(`coach-${athlete.coachId}`);

    // PR detection: check each drill with implementWeight + bestMark > 0
    type PRResult = { event: string; implement: string; distance: number; previousBest?: number };
    const prs: PRResult[] = [];
    for (const dl of created.drillLogs) {
      if (dl.implementWeight && dl.bestMark && dl.bestMark > 0) {
        const implementLabel = dl.implementWeightOriginal
          ? `${dl.implementWeightOriginal}${dl.implementWeightUnit ?? "kg"}`
          : `${parseFloat(dl.implementWeight.toFixed(2))}kg`;

        const prResult = await recordThrow({
          athleteId: athlete.id,
          event,
          implementWeightKg: dl.implementWeight,
          implementLabel,
          distance: dl.bestMark,
          achievedAt: date,
        });

        if (prResult.isPersonalBest) {
          prs.push({
            event,
            implement: implementLabel,
            distance: dl.bestMark,
            previousBest: prResult.previousDistance ?? undefined,
          });
        }
      }
    }

    // Bondarchuk validation
    let warnings: BondarchukWarning[] = [];
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

    return NextResponse.json({ success: true, data: created, prs, warnings }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/athlete/log-session", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: `Failed: ${message}` }, { status: 500 });
  }
}
