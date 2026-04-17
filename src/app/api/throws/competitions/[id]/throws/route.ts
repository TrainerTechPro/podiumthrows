import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, CompetitionThrowCreateSchema } from "@/lib/api-schemas";
import { validateThrowSlot } from "@/lib/competitions/validate";
import { getAthletePRs } from "@/lib/data/personal-records";
import { notifyCompetitionEvent } from "@/lib/competitions/notify";
import type { EventType, ThrowRound, FoulType } from "@prisma/client";

// Gender-default competition weights (matches personal-records.ts)
const COMP_WEIGHT: Record<string, { male: number; female: number }> = {
  SHOT_PUT: { male: 7.26, female: 4.0 },
  DISCUS: { male: 2.0, female: 1.0 },
  HAMMER: { male: 7.26, female: 4.0 },
  JAVELIN: { male: 0.8, female: 0.6 },
};

function resolveImplementWeight(
  event: string,
  gender: string | null,
  override: number | null
): number {
  if (override != null) return override;
  const w = COMP_WEIGHT[event];
  if (!w) return 0;
  return gender === "FEMALE" ? w.female : w.male;
}

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const meet = await prisma.throwsCompetition.findUnique({
      where: { id },
      select: { athleteId: true },
    });
    if (!meet) {
      return NextResponse.json({ success: false, error: "Competition not found" }, { status: 404 });
    }
    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        meet.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const throws = await prisma.throwLog.findMany({
      where: { competitionId: id },
      orderBy: [{ round: "asc" }, { attemptInRound: "asc" }],
    });

    return NextResponse.json({ success: true, data: throws });
  } catch (error) {
    logger.error("Get competition throws error", { context: "competitions/throws", error });
    return NextResponse.json({ success: false, error: "Failed to fetch throws" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const meet = await prisma.throwsCompetition.findUnique({
      where: { id },
      include: {
        athlete: { select: { gender: true } },
        throws: { select: { round: true, attemptInRound: true } },
      },
    });
    if (!meet) {
      return NextResponse.json({ success: false, error: "Competition not found" }, { status: 404 });
    }
    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        meet.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(request, CompetitionThrowCreateSchema);
    if (parsed instanceof NextResponse) return parsed;

    // Validate throw slot against competition format
    const format = (meet.format ?? "THREE_PLUS_THREE") as "THREE_PLUS_THREE" | "FOUR_STRAIGHT";
    const slotError = validateThrowSlot(
      format,
      parsed.round as ThrowRound,
      parsed.attemptInRound
    );
    if (slotError) {
      return NextResponse.json({ success: false, error: slotError }, { status: 400 });
    }

    // Uniqueness check — one throw per (competitionId, round, attemptInRound)
    const duplicate = meet.throws.some(
      (t) => t.round === parsed.round && t.attemptInRound === parsed.attemptInRound
    );
    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error: `Attempt ${parsed.attemptInRound} of ${parsed.round} already logged`,
        },
        { status: 409 }
      );
    }

    const implementWeight = resolveImplementWeight(
      meet.event,
      meet.athlete?.gender ?? null,
      meet.implementWeightKg
    );

    // PR snapshot BEFORE the write
    const beforePRs = await getAthletePRs(meet.athleteId);
    const beforeBest =
      beforePRs.events.find((e) => e.event === meet.event)?.competitionPR?.distance ?? 0;

    // Map discriminated union → throwLog columns
    let distance: number | null = null;
    let isFoul = false;
    let isPass = false;
    let foulType: FoulType | null = null;

    if (parsed.resultType === "MARK") {
      distance = parsed.distance;
    } else if (parsed.resultType === "FOUL") {
      isFoul = true;
      foulType = parsed.foulType as FoulType;
    } else if (parsed.resultType === "PASS") {
      isPass = true;
    }

    const throwLog = await prisma.throwLog.create({
      data: {
        athleteId: meet.athleteId,
        event: meet.event as EventType,
        implementWeight,
        implementWeightUnit: "kg",
        isCompetition: true,
        competitionId: meet.id,
        round: parsed.round as ThrowRound,
        attemptInRound: parsed.attemptInRound,
        isFoul,
        foulType,
        isPass,
        distance,
        notes: parsed.notes ?? null,
        videoUrl: parsed.videoUrl ?? null,
        wireLength: parsed.wireLength ?? null,
      },
    });

    // First throw: clear legacy single-result field
    const isFirstThrow = meet.throws.length === 0;
    if (isFirstThrow && meet.result != null) {
      await prisma.throwsCompetition.update({ where: { id: meet.id }, data: { result: null } });
    }

    // PR snapshot AFTER the write — getAthletePRs re-queries DB (React.cache is a no-op
    // in Route Handlers since there's no React render scope to deduplicate within)
    const afterPRs = await getAthletePRs(meet.athleteId);
    const afterBest =
      afterPRs.events.find((e) => e.event === meet.event)?.competitionPR?.distance ?? 0;

    const prCelebration =
      afterBest > beforeBest
        ? { event: meet.event as string, oldPR: beforeBest, newPR: afterBest }
        : null;

    // Fire-and-forget — notifyCompetitionEvent never throws
    void notifyCompetitionEvent({
      athleteId: meet.athleteId,
      actorRole: currentUser.role === "COACH" ? "COACH" : "ATHLETE",
      meetName: meet.name,
      competitionId: meet.id,
      prCelebration,
      isFirstThrow,
    });

    return NextResponse.json({ success: true, data: { throwLog, prCelebration } });
  } catch (error) {
    logger.error("Create competition throw error", { context: "competitions/throws", error });
    return NextResponse.json({ success: false, error: "Failed to create throw" }, { status: 500 });
  }
}
