import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { recalculateCoachPRs } from "@/lib/coach-throws";

/* ── GET — single coach session detail ── */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const entry = await prisma.coachThrowsSession.findUnique({
      where: { id: params.id },
      include: { drillLogs: { orderBy: { createdAt: "asc" } } },
    });

    if (!entry || entry.coachId !== coach.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: entry });
  } catch (err) {
    logger.error("GET /api/coach/log-session/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}

/* ── PUT — update a coach self-logged session ── */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const existing = await prisma.coachThrowsSession.findUnique({
      where: { id: params.id },
      select: { coachId: true },
    });
    if (!existing || existing.coachId !== coach.id) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    const body = await request.json();
    const {
      event, date, focus, notes, sleepQuality, sorenessLevel, energyLevel,
      sessionRpe, sessionFeeling, techniqueRating, mentalFocus, bestPart,
      improvementArea, drills,
    } = body;

    const updated = await prisma.$transaction(async (tx) => {
      // Delete existing drill logs and recreate
      await tx.coachDrillLog.deleteMany({ where: { sessionId: params.id } });

      return tx.coachThrowsSession.update({
        where: { id: params.id },
        data: {
          ...(event !== undefined && { event }),
          ...(date !== undefined && { date }),
          ...(focus !== undefined && { focus }),
          ...(notes !== undefined && { notes }),
          ...(sleepQuality !== undefined && { sleepQuality }),
          ...(sorenessLevel !== undefined && { sorenessLevel }),
          ...(energyLevel !== undefined && { energyLevel }),
          ...(sessionRpe !== undefined && { sessionRpe }),
          ...(sessionFeeling !== undefined && { sessionFeeling }),
          ...(techniqueRating !== undefined && { techniqueRating }),
          ...(mentalFocus !== undefined && { mentalFocus }),
          ...(bestPart !== undefined && { bestPart }),
          ...(improvementArea !== undefined && { improvementArea }),
          ...(drills && {
            drillLogs: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              create: drills.map((d: any) => ({
                drillType: d.drillType,
                implementWeight: d.implementWeight ?? null,
                implementWeightUnit: d.implementWeightUnit ?? "kg",
                implementWeightOriginal: d.implementWeightOriginal ?? null,
                wireLength: d.wireLength ?? null,
                throwCount: d.throwCount ?? 0,
                bestMark: d.bestMark ?? null,
                notes: d.notes?.trim() || null,
              })),
            },
          }),
        },
        include: { drillLogs: { orderBy: { createdAt: "asc" } } },
      });
    });

    // Recalculate PRs for the updated event
    if (updated.drillLogs.length > 0) {
      const affectedImplements = [
        ...new Set(
          updated.drillLogs
            .map((dl) => dl.implementWeight)
            .filter((w): w is number => w != null)
        ),
      ];
      if (affectedImplements.length > 0) {
        await recalculateCoachPRs(coach.id, updated.event, affectedImplements);
      }
    }

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    logger.error("PUT /api/coach/log-session/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

/* ── DELETE — remove a coach self-logged session ── */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const entry = await prisma.coachThrowsSession.findUnique({
      where: { id: params.id },
      select: {
        coachId: true,
        event: true,
        drillLogs: { select: { implementWeight: true } },
      },
    });

    if (!entry || entry.coachId !== coach.id) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    // Collect affected implements before deletion
    const affectedImplements = [
      ...new Set(
        entry.drillLogs
          .map((dl) => dl.implementWeight)
          .filter((w): w is number => w != null)
      ),
    ];

    await prisma.coachThrowsSession.delete({ where: { id: params.id } });

    // Recalculate PRs for affected (event, implement) pairs
    if (affectedImplements.length > 0) {
      await recalculateCoachPRs(coach.id, entry.event, affectedImplements);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("DELETE /api/coach/log-session/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
