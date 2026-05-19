import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, LogSessionSchema } from "@/lib/api-schemas";
import { findCatalogMatchForWeight, recomputeManyPRs } from "@/lib/implements";
import { EventType, type ImplementType } from "@prisma/client";

/** EventType (SHOT_PUT) → ImplementType (SHOT). */
function eventToImplementType(event: string): ImplementType | null {
  if (event === "SHOT_PUT") return "SHOT";
  if (event === "HAMMER" || event === "DISCUS" || event === "JAVELIN") return event;
  return null;
}

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
    return NextResponse.json({ success: false, error: "Couldn’t fetch session" }, { status: 500 });
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
    // Resolve catalog implementId for each drill before insert (same pattern
    // as POST). Edit replaces drill logs wholesale, so we recompute PR for
    // every (athlete, implement) combo touched by either the DELETED set or
    // the NEW set — covers the case where editing changed an implement.
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

    const updated = await prisma.$transaction(
      async (tx) => {
        // Capture pre-edit implementIds so we recompute the OLD combos too
        // (covers implement-change-on-edit cases).
        const oldDrills = await tx.athleteDrillLog.findMany({
          where: { sessionId: id },
          select: { implementId: true },
        });
        const oldImplementIds = new Set(
          oldDrills.map((d) => d.implementId).filter((x): x is string => x != null)
        );

        // Drill logs stay "replace" — they're a separate relation the client
        // always sends in full. The merge rule is for scalar session fields.
        await tx.athleteDrillLog.deleteMany({ where: { sessionId: id } });
        const result = await tx.athleteThrowsSession.update({
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
            drillLogs: { create: drillsWithCatalog },
          },
          include: { drillLogs: true },
        });

        // Recompute every (athlete, implement) we either left or arrived at.
        const allImplementIds = new Set<string>(oldImplementIds);
        for (const d of drillsWithCatalog) {
          if (d.implementId) allImplementIds.add(d.implementId);
        }
        const targets = Array.from(allImplementIds).map((implementId) => ({
          athleteId: athlete.id,
          implementId,
        }));
        if (targets.length > 0) {
          await recomputeManyPRs(tx, targets);
        }
        return result;
      },
      { timeout: 30_000 }
    );

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

    // Capture each drill log's catalog identity BEFORE delete so we can
    // recompute the affected (athlete, implement) PRs after the cascade.
    const entry = await prisma.athleteThrowsSession.findUnique({
      where: { id: id },
      select: {
        athleteId: true,
        drillLogs: { select: { implementId: true } },
      },
    });

    if (!entry || entry.athleteId !== athlete.id) {
      return NextResponse.json(
        { success: false, error: "Not found or unauthorized" },
        { status: 404 }
      );
    }

    const affectedImplementIds = Array.from(
      new Set(entry.drillLogs.map((d) => d.implementId).filter((x): x is string => x != null))
    );

    await prisma.$transaction(
      async (tx) => {
        await tx.athleteThrowsSession.delete({ where: { id: id } });
        if (affectedImplementIds.length > 0) {
          const targets = affectedImplementIds.map((implementId) => ({
            athleteId: athlete.id,
            implementId,
          }));
          await recomputeManyPRs(tx, targets);
        }
      },
      { timeout: 30_000 }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/athlete/log-session/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Couldn’t delete" }, { status: 500 });
  }
}
