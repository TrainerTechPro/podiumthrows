import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBodyText, LogSessionSchema } from "@/lib/api-schemas";
import { withIdempotency } from "@/lib/idempotency";
import { validateFullSession, type BondarchukWarning, type BlockInput } from "@/lib/bondarchuk";
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
        implementId?: string | null;
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

    // WEIGHT_THROW is allowed: AthleteThrowsSession.event is TEXT (not enum),
    // and weight-throw sessions log work against custom non-traditional
    // implements (tires, plates, weighted balls). PR detection and goal
    // sync skip WEIGHT_THROW drills so they don't pollute event-keyed PRs.
    if (!["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN", "WEIGHT_THROW"].includes(event)) {
      return NextResponse.json({ success: false, error: "Invalid event type" }, { status: 400 });
    }

    // Resolve catalog identity for each drill in two passes:
    //   1. If the client supplied implementId (custom implements + new client
    //      flows), trust it directly and derive weight/unit from the catalog.
    //   2. Otherwise fall back to the weight-based fuzzy matcher
    //      (findCatalogMatchForWeight) for legacy clients that only post
    //      kg+unit. Exact/tolerated → assign; ambiguous/none → leave null.
    const throwType = eventToImplementType(event);
    const directIds = Array.from(
      new Set(
        (drills || [])
          .map((d) => d.implementId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );
    const directImpls = directIds.length
      ? await prisma.implement.findMany({
          where: { id: { in: directIds } },
          select: { id: true, weightKg: true, weightLb: true, primaryUnit: true, throwType: true },
        })
      : [];
    const directById = new Map(directImpls.map((i) => [i.id, i]));

    const drillsWithCatalog: Array<{
      drillType: string;
      implementId: string | null;
      implementThrowType: string | null;
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
      let implementThrowType: string | null = null;
      let weightKg: number | null = d.implementWeight ?? null;
      let weightUnit: string = d.implementWeightUnit ?? "kg";
      let weightOriginal: number | null = d.implementWeightOriginal ?? null;

      const direct = d.implementId ? (directById.get(d.implementId) ?? null) : null;
      if (direct) {
        implementId = direct.id;
        implementThrowType = direct.throwType;
        weightKg = direct.weightKg;
        weightUnit = direct.primaryUnit === "lb" ? "lbs" : "kg";
        weightOriginal = direct.primaryUnit === "lb" ? direct.weightLb : direct.weightKg;
      } else if (throwType && d.implementWeight && d.implementWeight > 0) {
        const isLb = d.implementWeightUnit === "lbs" || d.implementWeightUnit === "lb";
        const match = await findCatalogMatchForWeight(d.implementWeight, throwType, {
          unitSystem: isLb ? "imperial" : "metric",
        });
        if (match.kind === "exact" || match.kind === "tolerated") {
          implementId = match.implement.id;
          implementThrowType = match.implement.throwType;
        }
      }
      drillsWithCatalog.push({
        drillType: d.drillType,
        implementId,
        implementThrowType,
        implementWeight: weightKg,
        implementWeightUnit: weightUnit,
        implementWeightOriginal: weightOriginal,
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
        // implementThrowType is in-memory only — strip before Prisma insert.
        drillLogs: {
          create: drillsWithCatalog.map(({ implementThrowType: _t, ...rest }) => rest),
        },
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

    // PR detection: check each drill with implementWeight + bestMark > 0.
    // Skip WEIGHT_THROW drills (tires, plates) — they aren't competition
    // events and shouldn't attribute against the session's traditional event.
    // The catalog-keyed AthleteImplementPR refresh above handles them.
    type PRResult = { event: string; implement: string; distance: number; previousBest?: number };
    const prs: PRResult[] = [];
    const drillThrowTypeById = new Map(
      drillsWithCatalog
        .filter((d) => d.implementId)
        .map((d) => [d.implementId!, d.implementThrowType])
    );
    for (const dl of created.drillLogs) {
      if (dl.implementId && drillThrowTypeById.get(dl.implementId) === "WEIGHT_THROW") continue;
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
      // WEIGHT_THROW drills don't share an EventType with the session, so the
      // comp-weight comparison would either miss or falsely match. Filter
      // them out before sync.
      const goalEligible = created.drillLogs.filter(
        (dl) => !dl.implementId || drillThrowTypeById.get(dl.implementId) !== "WEIGHT_THROW"
      );
      const result = await syncGoalsFromDrillLogs(athlete.id, event, athlete.gender, goalEligible);
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
      // validateFullSession also runs the 15-20% weight differential rule
      // (Vol IV p.85-88) so the response includes both descending-order
      // and differential warnings.
      const result = validateFullSession([throwingBlock]);
      warnings = result.warnings;
    }

    return NextResponse.json(
      { success: true, data: { ...created, prs, warnings, goalCelebrations } },
      { status: 201 }
    );
  } catch (err) {
    logger.error("POST /api/athlete/log-session", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: `Failed: ${message}` }, { status: 500 });
  }
}
