import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { recalculateCoachPRs } from "@/lib/coach-throws";
import { parseBody, LogSessionSchema } from "@/lib/api-schemas";
import { findCatalogMatchForWeight } from "@/lib/implements";
import { EventType, type ImplementType } from "@prisma/client";

/** EventType (SHOT_PUT) → ImplementType (SHOT). */
function eventToImplementType(event: string): ImplementType | null {
  if (event === "SHOT_PUT") return "SHOT";
  if (event === "HAMMER" || event === "DISCUS" || event === "JAVELIN") return event;
  return null;
}

/* ── GET — single coach session detail ── */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    const entry = await prisma.coachThrowsSession.findUnique({
      where: { id: id },
      include: { drillLogs: { orderBy: { createdAt: "asc" } } },
    });

    if (!entry || entry.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (err) {
    logger.error("GET /api/coach/log-session/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to fetch session" }, { status: 500 });
  }
}

/* ── PUT — update a coach self-logged session ── */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    const existing = await prisma.coachThrowsSession.findUnique({
      where: { id: id },
      select: { coachId: true },
    });
    if (!existing || existing.coachId !== coach.id) {
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

    // Resolve catalog implementId per drill before insert. Same pattern as
    // POST and as the athlete log-session edit path.
    const throwType = eventToImplementType(p.event);
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
    for (const d of p.drills || []) {
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
        throwCount: d.throwCount ?? 0,
        bestMark: d.bestMark ?? null,
        bestMarkUnit: d.bestMarkUnit ?? "meters",
        bestMarkOriginal: d.bestMarkOriginal ?? null,
        notes: d.notes?.trim() || null,
      });
    }

    // Merge-update: only fields present in the request are written. Omitted
    // fields are left alone; explicit null clears a field. Drill logs always
    // replace — they're a separate relation the client sends in full.
    //
    // The LogSessionSchema .superRefine enforces Bondarchuk descending-weight
    // sequencing at this boundary. Any ascending sequence is rejected with a
    // 400 before reaching Prisma — route cannot bypass the invariant.
    const updated = await prisma.$transaction(async (tx) => {
      await tx.coachDrillLog.deleteMany({ where: { sessionId: id } });
      return tx.coachThrowsSession.update({
        where: { id: id },
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
          drillLogs: { create: drillsWithCatalog },
        },
        include: { drillLogs: { orderBy: { createdAt: "asc" } } },
      });
    });

    // Recalculate PRs for the updated event
    if (updated.drillLogs.length > 0) {
      const affectedImplements = [
        ...new Set(
          updated.drillLogs.map((dl) => dl.implementWeight).filter((w): w is number => w != null)
        ),
      ];
      if (affectedImplements.length > 0) {
        await recalculateCoachPRs(coach.id, updated.event, affectedImplements);
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    logger.error("PUT /api/coach/log-session/[id]", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to update session" },
      { status: 500 }
    );
  }
}

/* ── DELETE — remove a coach self-logged session ── */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const entry = await prisma.coachThrowsSession.findUnique({
      where: { id: id },
      select: {
        coachId: true,
        event: true,
        drillLogs: { select: { implementWeight: true } },
      },
    });

    if (!entry || entry.coachId !== coach.id) {
      return NextResponse.json(
        { success: false, error: "Not found or unauthorized" },
        { status: 404 }
      );
    }

    // Collect affected implements before deletion
    const affectedImplements = [
      ...new Set(
        entry.drillLogs.map((dl) => dl.implementWeight).filter((w): w is number => w != null)
      ),
    ];

    await prisma.coachThrowsSession.delete({ where: { id: id } });

    // Recalculate PRs for affected (event, implement) pairs
    if (affectedImplements.length > 0) {
      await recalculateCoachPRs(coach.id, entry.event, affectedImplements);
    }

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (err) {
    logger.error("DELETE /api/coach/log-session/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
}
