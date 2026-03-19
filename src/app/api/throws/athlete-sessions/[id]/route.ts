import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

// GET  /api/throws/athlete-sessions/[id]  — fetch a single session with drill logs
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const session = await prisma.athleteThrowsSession.findUnique({
      where: { id: params.id },
      include: { drillLogs: { orderBy: { createdAt: "asc" } } },
    });

    if (!session) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", session.athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: session });
  } catch (err) {
    logger.error("athlete-sessions [id] GET error", { context: "throws/athlete-sessions/[id]", error: err });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

// PUT  /api/throws/athlete-sessions/[id]  — update an existing session + drill logs
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const existing = await prisma.athleteThrowsSession.findUnique({
      where: { id: params.id },
      select: { id: true, athleteId: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", existing.athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
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
      drillLogs,
    } = body;

    // Update session and replace drill logs in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Delete all existing drill logs for this session
      await tx.athleteDrillLog.deleteMany({
        where: { sessionId: params.id },
      });

      // Update session fields and recreate drill logs
      const session = await tx.athleteThrowsSession.update({
        where: { id: params.id },
        data: {
          event: event ?? undefined,
          date: date ?? undefined,
          focus: focus !== undefined ? (focus || null) : undefined,
          notes: notes !== undefined ? (notes || null) : undefined,
          sleepQuality: sleepQuality !== undefined ? sleepQuality : undefined,
          sorenessLevel: sorenessLevel !== undefined ? sorenessLevel : undefined,
          energyLevel: energyLevel !== undefined ? energyLevel : undefined,
          sessionRpe: sessionRpe !== undefined ? sessionRpe : undefined,
          sessionFeeling: sessionFeeling !== undefined ? (sessionFeeling || null) : undefined,
          techniqueRating: techniqueRating !== undefined ? techniqueRating : undefined,
          mentalFocus: mentalFocus !== undefined ? mentalFocus : undefined,
          bestPart: bestPart !== undefined ? (bestPart || null) : undefined,
          improvementArea: improvementArea !== undefined ? (improvementArea || null) : undefined,
          drillLogs: drillLogs?.length
            ? {
                create: (drillLogs as Array<{
                  drillType: string;
                  implementWeight?: number | null;
                  implementWeightUnit?: string | null;
                  implementWeightOriginal?: number | null;
                  wireLength?: string | null;
                  throwCount?: number;
                  bestMark?: number | null;
                  notes?: string | null;
                }>).map((d) => ({
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
        include: { drillLogs: { orderBy: { createdAt: "asc" } } },
      });

      return session;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    logger.error("athlete-sessions [id] PUT error", { context: "throws/athlete-sessions/[id]", error: err });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
