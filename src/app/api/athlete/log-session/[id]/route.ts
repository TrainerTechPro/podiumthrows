import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, LogSessionSchema } from "@/lib/api-schemas";
import { EventType } from "@prisma/client";

/* ── GET — single session detail (athlete-self OR their coach) ── */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const entry = await prisma.athleteThrowsSession.findUnique({
      where: { id: id },
      include: {
        drillLogs: { orderBy: { createdAt: "asc" } },
        athlete: { select: { userId: true, firstName: true, lastName: true, coachId: true } },
      },
    });

    if (!entry) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const isOwner = entry.athlete.userId === session.userId;
    let isTheirCoach = false;
    if (!isOwner && session.role === "COACH") {
      const coach = await prisma.coachProfile.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      });
      isTheirCoach = coach != null && entry.athlete.coachId === coach.id;
    }

    if (!isOwner && !isTheirCoach) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (err) {
    logger.error("GET /api/athlete/log-session/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to fetch session" }, { status: 500 });
  }
}

/* ── PUT — update a self-logged session (athlete only, owns it) ── */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    const existing = await prisma.athleteThrowsSession.findUnique({
      where: { id },
      select: { athleteId: true },
    });
    if (!existing || existing.athleteId !== athlete.id) {
      return NextResponse.json(
        { success: false, error: "Not found or unauthorized" },
        { status: 404 }
      );
    }

    const parsed = await parseBody(request, LogSessionSchema);
    if (parsed instanceof NextResponse) return parsed;
    const p = parsed as z.infer<typeof LogSessionSchema>;

    if (!["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"].includes(p.event)) {
      return NextResponse.json({ success: false, error: "Invalid event type" }, { status: 400 });
    }

    // Merge-update: only fields present in the request body are written.
    // Omitted fields are left alone — this prevents the revamped wizard
    // (which no longer renders readiness/technique/mental/best-part/
    // improvement-area) from overwriting those values with null when a
    // pre-revamp session is edited. Explicit nulls still clear a field.
    //
    // PRs are intentionally NOT recomputed on edit — the ThrowsPR table
    // remains authoritative and is only advanced on create. This prevents
    // edits from retroactively lowering a PR.
    const updated = await prisma.$transaction(async (tx) => {
      // Drill logs stay "replace" — they're a separate relation the client
      // always sends in full. The merge rule is for scalar session fields.
      await tx.athleteDrillLog.deleteMany({ where: { sessionId: id } });
      return tx.athleteThrowsSession.update({
        where: { id },
        data: {
          event: p.event as EventType,
          date: p.date,
          ...(p.focus !== undefined && { focus: p.focus || null }),
          ...(p.notes !== undefined && { notes: p.notes?.trim() || null }),
          ...(p.sleepQuality !== undefined && { sleepQuality: p.sleepQuality }),
          ...(p.sorenessLevel !== undefined && { sorenessLevel: p.sorenessLevel }),
          ...(p.energyLevel !== undefined && { energyLevel: p.energyLevel }),
          ...(p.sessionRpe !== undefined && { sessionRpe: p.sessionRpe }),
          ...(p.sessionFeeling !== undefined && { sessionFeeling: p.sessionFeeling || null }),
          ...(p.techniqueRating !== undefined && { techniqueRating: p.techniqueRating }),
          ...(p.mentalFocus !== undefined && { mentalFocus: p.mentalFocus }),
          ...(p.bestPart !== undefined && { bestPart: p.bestPart?.trim() || null }),
          ...(p.improvementArea !== undefined && {
            improvementArea: p.improvementArea?.trim() || null,
          }),
          drillLogs: {
            create: (p.drills || []).map((d) => ({
              drillType: d.drillType,
              implementWeight: d.implementWeight ?? null,
              implementWeightUnit: d.implementWeightUnit ?? "kg",
              implementWeightOriginal: d.implementWeightOriginal ?? null,
              wireLength: d.wireLength ?? null,
              throwCount: d.throwCount ?? 0,
              bestMark: d.bestMark ?? null,
              bestMarkUnit: d.bestMarkUnit ?? "meters",
              bestMarkOriginal: d.bestMarkOriginal ?? null,
              notes: d.notes?.trim() || null,
            })),
          },
        },
        include: { drillLogs: true },
      });
    });

    revalidateTag(`athlete-${athlete.id}`);
    if (athlete.coachId) revalidateTag(`coach-${athlete.coachId}`);

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    logger.error("PUT /api/athlete/log-session/[id]", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: `Failed: ${message}` }, { status: 500 });
  }
}

/* ── DELETE — remove a self-logged session ── */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json(
        { success: false, error: "Athlete profile not found" },
        { status: 404 }
      );
    }

    const entry = await prisma.athleteThrowsSession.findUnique({
      where: { id: id },
      select: { athleteId: true },
    });

    if (!entry || entry.athleteId !== athlete.id) {
      return NextResponse.json(
        { success: false, error: "Not found or unauthorized" },
        { status: 404 }
      );
    }

    await prisma.athleteThrowsSession.delete({ where: { id: id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/athlete/log-session/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
}
