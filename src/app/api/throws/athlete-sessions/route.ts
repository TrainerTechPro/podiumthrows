import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBodyText, AthleteThrowsSessionCreateSchema } from "@/lib/api-schemas";
import { withIdempotency } from "@/lib/idempotency";
import { syncGoalsFromDrillLogs } from "@/lib/throws/goal-sync";
import { recordThrow } from "@/lib/throws/pr";
import { recomputeManyPRs } from "@/lib/implements";
import { EventType } from "@prisma/client";

export type AthleteSessionPRResult = {
  event: string;
  implement: string;
  distance: number;
  previousBest: number | null;
  previousBestDate: string | null;
};

// Scan drill logs for PR-eligible best marks and write through recordThrow.
// Mirrors the pattern used by /api/athlete/log-session so the celebration
// stack on the client can be unified across both surfaces.
async function detectSessionPRs(
  athleteId: string,
  event: string,
  date: string,
  drillLogs: Array<{
    implementWeight: number | null;
    implementWeightOriginal: number | null;
    implementWeightUnit: string | null;
    bestMark: number | null;
    implement: { throwType: string } | null;
  }>
): Promise<AthleteSessionPRResult[]> {
  const prs: AthleteSessionPRResult[] = [];
  for (const dl of drillLogs) {
    if (!dl.implementWeight || !dl.bestMark || dl.bestMark <= 0) continue;
    // WEIGHT_THROW drills (tires, plates, etc.) aren't competition events and
    // don't attribute against the session's traditional event PR. The
    // catalog-keyed AthleteImplementPR system handles them separately.
    if (dl.implement?.throwType === "WEIGHT_THROW") continue;
    const implementLabel = dl.implementWeightOriginal
      ? `${dl.implementWeightOriginal}${dl.implementWeightUnit ?? "kg"}`
      : `${parseFloat(dl.implementWeight.toFixed(2))}kg`;
    const result = await recordThrow({
      athleteId,
      event,
      implementWeightKg: dl.implementWeight,
      implementLabel,
      distance: dl.bestMark,
      achievedAt: date,
    });
    if (result.isPersonalBest) {
      prs.push({
        event,
        implement: implementLabel,
        distance: dl.bestMark,
        previousBest: result.previousDistance,
        previousBestDate: result.previousAchievedAt,
      });
    }
  }
  return prs;
}

// GET  /api/throws/athlete-sessions?athleteId=...   — list self-logged sessions
// POST /api/throws/athlete-sessions                  — create a self-logged session
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");

    if (!athleteId) {
      return NextResponse.json({ success: false, error: "athleteId is required" }, { status: 400 });
    }

    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const sessions = await prisma.athleteThrowsSession.findMany({
      where: { athleteId },
      include: { drillLogs: { orderBy: { createdAt: "asc" } } },
      orderBy: { date: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: sessions });
  } catch (err) {
    logger.error("athlete-sessions GET error", { context: "throws/athlete-sessions", error: err });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  return withIdempotency(
    { userId: currentUser.userId, endpoint: "/api/throws/athlete-sessions", req: request },
    async (bodyText) => postHandler(currentUser, bodyText)
  );
}

async function postHandler(
  currentUser: { userId: string; role: string },
  bodyText: string
): Promise<NextResponse> {
  try {
    const parsed = parseBodyText(bodyText, AthleteThrowsSessionCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { athleteId, event, date, notes, drillLogs } = parsed;

    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Resolve implementId → catalog row for any drill that supplied one. The
    // client can omit weight fields when implementId is set; we backfill from
    // the catalog so labels stay consistent and customs (3/4 wire hammers,
    // tires, plates) work without the client knowing the canonical kg value.
    type IncomingDrill = {
      drillType: string;
      implementId?: string | null;
      implementWeight?: number | null;
      implementWeightUnit?: string | null;
      implementWeightOriginal?: number | null;
      wireLength?: string | null;
      throwCount?: number | null;
      bestMark?: number | null;
      bestMarkUnit?: string | null;
      bestMarkOriginal?: number | null;
      notes?: string | null;
    };
    const incomingDrills = (drillLogs ?? []) as IncomingDrill[];

    const implementIdsToResolve = Array.from(
      new Set(incomingDrills.map((d) => d.implementId).filter((id): id is string => Boolean(id)))
    );
    const resolvedImplements = implementIdsToResolve.length
      ? await prisma.implement.findMany({
          where: { id: { in: implementIdsToResolve } },
          select: { id: true, weightKg: true, weightLb: true, primaryUnit: true, throwType: true },
        })
      : [];
    const implementsById = new Map(resolvedImplements.map((i) => [i.id, i]));

    const drillCreates = incomingDrills.map((d) => {
      const impl = d.implementId ? (implementsById.get(d.implementId) ?? null) : null;
      // When the catalog row is known, derive weight/unit/original from it so
      // the row is self-consistent regardless of what the client posted. The
      // client-typed fields still win when there's no catalog row (legacy path).
      const implementWeight = impl ? impl.weightKg : (d.implementWeight ?? null);
      const implementWeightUnit = impl
        ? impl.primaryUnit === "lb"
          ? "lbs"
          : "kg"
        : (d.implementWeightUnit ?? "kg");
      const implementWeightOriginal = impl
        ? impl.primaryUnit === "lb"
          ? impl.weightLb
          : impl.weightKg
        : (d.implementWeightOriginal ?? null);
      return {
        drillType: d.drillType,
        implementId: impl?.id ?? null,
        implementWeight,
        implementWeightUnit,
        implementWeightOriginal,
        wireLength: d.wireLength ?? null,
        throwCount: d.throwCount ?? 0,
        bestMark: d.bestMark ?? null,
        bestMarkUnit: d.bestMarkUnit ?? "meters",
        bestMarkOriginal: d.bestMarkOriginal ?? null,
        notes: d.notes ?? null,
      };
    });

    const session = await prisma.athleteThrowsSession.create({
      data: {
        athleteId,
        event: event as EventType,
        date,
        notes: notes || null,
        drillLogs: drillCreates.length ? { create: drillCreates } : undefined,
      },
      include: { drillLogs: { include: { implement: true } } },
    });

    // PR detection across all drill logs with a best mark. Best-effort —
    // a failure here must never crash the save (the session is already
    // persisted) but is logged so we don't lose silent regressions.
    let prs: AthleteSessionPRResult[] = [];
    try {
      prs = await detectSessionPRs(athleteId, event, date, session.drillLogs);
    } catch (err) {
      logger.error("PR detection after session create failed", {
        context: "throws/athlete-sessions",
        error: err,
      });
    }

    // Catalog-keyed PR aggregate refresh for any drill rows with an
    // implementId. Same best-effort posture — the session is durable
    // even if the recompute later fails. Covers WEIGHT_THROW customs
    // (which the legacy PR system above intentionally skips).
    try {
      const items = session.drillLogs
        .filter((dl) => dl.implementId != null)
        .map((dl) => ({ athleteId, implementId: dl.implementId! }));
      if (items.length) {
        await recomputeManyPRs(prisma, items);
      }
    } catch (err) {
      logger.error("catalog PR recompute after session create failed", {
        context: "throws/athlete-sessions",
        error: err,
      });
    }

    // Sync matching active goals from any competition-weight best marks in
    // this session. Best-effort — a failure here must not fail the save.
    let athleteCoachId: string | null = null;
    let goalCelebrations: Awaited<ReturnType<typeof syncGoalsFromDrillLogs>>["celebrations"] = [];
    try {
      const athlete = await prisma.athleteProfile.findUnique({
        where: { id: athleteId },
        select: { gender: true, coachId: true },
      });
      if (athlete) {
        athleteCoachId = athlete.coachId;
        // Skip WEIGHT_THROW drills — goal sync compares against competition
        // weights for the 4 traditional events; a 7.26kg tire would falsely
        // match the hammer comp weight.
        const goalEligible = session.drillLogs.filter(
          (dl) => dl.implement?.throwType !== "WEIGHT_THROW"
        );
        const result = await syncGoalsFromDrillLogs(athleteId, event, athlete.gender, goalEligible);
        goalCelebrations = result.celebrations;
      }
    } catch (err) {
      logger.error("goal sync after session create failed", {
        context: "throws/athlete-sessions",
        error: err,
      });
    }

    // Invalidate cached data so other widgets update without a page refresh
    revalidateTag(`athlete-${athleteId}`);
    if (athleteCoachId) revalidateTag(`coach-${athleteCoachId}`);

    return NextResponse.json({
      success: true,
      data: session,
      prs,
      goalCelebrations,
    });
  } catch (err) {
    logger.error("athlete-sessions POST error", { context: "throws/athlete-sessions", error: err });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
