import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBodyText, AthleteThrowsSessionCreateSchema } from "@/lib/api-schemas";
import { withIdempotency } from "@/lib/idempotency";
import { syncGoalsFromDrillLogs } from "@/lib/throws/goal-sync";
import { EventType } from "@prisma/client";

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

    const session = await prisma.athleteThrowsSession.create({
      data: {
        athleteId,
        event: event as EventType,
        date,
        notes: notes || null,
        drillLogs: drillLogs?.length
          ? {
              create: (
                drillLogs as Array<{
                  drillType: string;
                  implementWeight?: number | null;
                  implementWeightUnit?: string | null;
                  implementWeightOriginal?: number | null;
                  wireLength?: string | null;
                  throwCount?: number;
                  bestMark?: number | null;
                  notes?: string | null;
                }>
              ).map((d) => ({
                drillType: d.drillType,
                implementWeight: d.implementWeight ?? null,
                implementWeightUnit: d.implementWeightUnit ?? "kg",
                implementWeightOriginal: d.implementWeightOriginal ?? null,
                wireLength: d.wireLength ?? null,
                throwCount: d.throwCount ?? 0,
                bestMark: d.bestMark ?? null,
                notes: d.notes ?? null,
              })),
            }
          : undefined,
      },
      include: { drillLogs: true },
    });

    // Sync matching active goals from any competition-weight best marks in
    // this session. Best-effort — a failure here must not fail the save.
    let athleteCoachId: string | null = null;
    try {
      const athlete = await prisma.athleteProfile.findUnique({
        where: { id: athleteId },
        select: { gender: true, coachId: true },
      });
      if (athlete) {
        athleteCoachId = athlete.coachId;
        await syncGoalsFromDrillLogs(athleteId, event, athlete.gender, session.drillLogs);
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

    return NextResponse.json({ success: true, data: session });
  } catch (err) {
    logger.error("athlete-sessions POST error", { context: "throws/athlete-sessions", error: err });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
