import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { checkAndSetCoachPR } from "@/lib/coach-throws";
import {
  validateImplementSequence,
  type BondarchukWarning,
  type BlockInput,
} from "@/lib/bondarchuk";
import { parseBody, LogSessionSchema } from "@/lib/api-schemas";
import { findCatalogMatchForWeight } from "@/lib/implements";
import { EventType, type ImplementType } from "@prisma/client";

/** EventType (SHOT_PUT) → ImplementType (SHOT). */
function eventToImplementType(event: string): ImplementType | null {
  if (event === "SHOT_PUT") return "SHOT";
  if (event === "HAMMER" || event === "DISCUS" || event === "JAVELIN") return event;
  return null;
}

/* ── GET — list coach's self-logged sessions ── */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 404 }
      );
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

    return NextResponse.json({ success: true, data: sessions });
  } catch (err) {
    logger.error("GET /api/coach/log-session", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

/* ── POST — create a coach self-logged session ── */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
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

    // Resolve catalog implementId per drill before insert. Same pattern as
    // athlete log-session: exact/tolerated → assign, ambiguous/none → null.
    // CoachPR (legacy table) continues to track coach training PRs unchanged;
    // implementId here is for canonical labels + future catalog reads.
    const throwType = eventToImplementType(event);
    const drillsWithCatalog: Array<{
      drillType: string;
      implementId: string | null;
      implementWeight: number | null;
      implementWeightUnit: string;
      implementWeightOriginal: number | null;
      wireLength: string | null;
      throwCount: number;
      bestMark: number | null;
      bestMarkUnit: "meters" | "feet";
      bestMarkOriginal: number | null;
      notes: string | null;
    }> = [];
    for (const d of drills || []) {
      let implementId: string | null = null;
      if (throwType && d.implementWeight && d.implementWeight > 0) {
        const isLb = d.implementWeightUnit === "lbs" || d.implementWeightUnit === "lb";
        const match = await findCatalogMatchForWeight(d.implementWeight, throwType, {
          unitSystem: isLb ? "imperial" : "metric",
        });
        if (match.kind === "exact" || match.kind === "tolerated") {
          implementId = match.implement.id;
        }
      }
      drillsWithCatalog.push({
        drillType: d.drillType,
        implementId,
        implementWeight: d.implementWeight ?? null,
        implementWeightUnit: d.implementWeightUnit ?? "kg",
        implementWeightOriginal: d.implementWeightOriginal ?? null,
        wireLength: d.wireLength ?? null,
        throwCount: d.throwCount || 0,
        bestMark: d.bestMark ?? null,
        bestMarkUnit: d.bestMarkUnit ?? "meters",
        bestMarkOriginal: d.bestMarkOriginal ?? null,
        notes: d.notes?.trim() || null,
      });
    }

    const created = await prisma.coachThrowsSession.create({
      data: {
        coachId: coach.id,
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
        drillLogs: { create: drillsWithCatalog },
      },
      include: { drillLogs: true },
    });

    // PR detection: check each drill with implementWeight + bestMark > 0
    type PRResult = { event: string; implement: string; distance: number; previousBest?: number };
    const prs: PRResult[] = [];
    for (const dl of created.drillLogs) {
      if (dl.implementWeight && dl.bestMark && dl.bestMark > 0) {
        const implementLabel = dl.implementWeightOriginal
          ? `${dl.implementWeightOriginal}${dl.implementWeightUnit ?? "kg"}`
          : undefined;
        const result = await checkAndSetCoachPR(
          coach.id,
          event,
          dl.implementWeight,
          dl.bestMark,
          new Date(date),
          created.id,
          dl.drillType,
          implementLabel
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

    return NextResponse.json({ success: true, data: created, prs, warnings }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/coach/log-session", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: `Failed: ${message}` }, { status: 500 });
  }
}
