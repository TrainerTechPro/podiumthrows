import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBodyText, LogSessionSchema } from "@/lib/api-schemas";
import { withIdempotency } from "@/lib/idempotency";
import {
  validateImplementSequence,
  type BondarchukWarning,
  type BlockInput,
} from "@/lib/bondarchuk";
import { recordThrow } from "@/lib/throws/pr";
import { syncGoalsFromDrillLogs } from "@/lib/throws/goal-sync";
import { findCatalogMatchForWeight, recomputeManyPRs } from "@/lib/implements";
import { EventType, type ImplementType } from "@prisma/client";

/** EventType (SHOT_PUT) → ImplementType (SHOT). */
function eventToImplementType(event: string): ImplementType | null {
  if (event === "SHOT_PUT") return "SHOT";
  if (event === "HAMMER" || event === "DISCUS" || event === "JAVELIN") return event;
  return null;
}
import { onSessionComplete } from "@/lib/sessions/on-session-complete";
import type { MilestoneCelebration } from "@/lib/goals/milestones";

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
  const session = await getSession();
  if (!session || !(await canActAsAthlete(session))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return withIdempotency(
    { userId: session.userId, endpoint: "/api/athlete/log-session", req: request },
    async (bodyText) => postHandler(session.userId, bodyText)
  );
}

async function postHandler(userId: string, bodyText: string): Promise<NextResponse> {
  try {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId },
      select: { id: true, coachId: true, firstName: true, lastName: true, gender: true },
    });
    if (!athlete) {
      return NextResponse.json(
        { success: false, error: "Athlete profile not found" },
        { status: 404 }
      );
    }

    const parsed = parseBodyText(bodyText, LogSessionSchema);
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

    // Resolve catalog implementId for each drill so new logs land
    // catalog-keyed from day one. The matcher uses the per-drill unit hint;
    // exact/tolerated → assign, ambiguous/none → leave null (the Fix UI
    // will surface them).
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
        drillLogs: { create: drillsWithCatalog },
      },
      include: {
        drillLogs: true,
      },
    });

    // Recompute catalog AthleteImplementPR for every distinct (athlete,
    // implement) we just touched. De-duped inside recomputeManyPRs.
    const recomputeTargets = drillsWithCatalog
      .filter((d): d is typeof d & { implementId: string } => d.implementId != null)
      .map((d) => ({ athleteId: athlete.id, implementId: d.implementId }));
    if (recomputeTargets.length > 0) {
      await prisma.$transaction(async (tx) => recomputeManyPRs(tx, recomputeTargets), {
        timeout: 30_000,
      });
    }

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

    // Sync matching active goals + collect milestone celebrations to surface
    // to the client. Best-effort — a goal-sync failure must not fail the
    // session save (the throw still landed; the goal state can recover on
    // the next log).
    let goalCelebrations: MilestoneCelebration[] = [];
    try {
      const result = await syncGoalsFromDrillLogs(
        athlete.id,
        event,
        athlete.gender,
        created.drillLogs
      );
      goalCelebrations = result.celebrations;
    } catch (err) {
      logger.error("goal sync after self-logged session failed", {
        context: "athlete/log-session",
        error: err,
      });
    }

    const throwCount = created.drillLogs.reduce((sum, dl) => sum + (dl.throwCount ?? 0), 0);
    const bestMarkM = created.drillLogs.reduce(
      (max, dl) => (dl.bestMark != null && dl.bestMark > max ? dl.bestMark : max),
      0
    );
    const athleteName =
      [athlete.firstName, athlete.lastName].filter(Boolean).join(" ") || "Athlete";

    await onSessionComplete({
      athleteId: athlete.id,
      coachId: athlete.coachId ?? null,
      source: "self-logged",
      sourceId: created.id,
      terminalStatus: "completed",
      completedAt: created.createdAt,
      sessionTitle: `${event} — ${focus ?? "Practice"}`,
      athleteName,
      metrics: {
        throwCount,
        bestMarkM: bestMarkM > 0 ? bestMarkM : null,
        rpe: sessionRpe ?? null,
        selfFeeling: sessionFeeling ?? null,
      },
    });

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

    return NextResponse.json(
      { success: true, data: created, prs, warnings, goalCelebrations },
      { status: 201 }
    );
  } catch (err) {
    logger.error("POST /api/athlete/log-session", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: `Failed: ${message}` }, { status: 500 });
  }
}
