import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, ThrowsBlockLogCreateSchema } from "@/lib/api-schemas";
import { parseImplementKg } from "@/lib/throws";
import { findCatalogMatchForWeight, recomputeManyPRs } from "@/lib/implements";
import type { ImplementType } from "@prisma/client";

/** EventType (SHOT_PUT) → ImplementType (SHOT). */
function eventToImplementType(event: string): ImplementType | null {
  if (event === "SHOT_PUT") return "SHOT";
  if (event === "HAMMER" || event === "DISCUS" || event === "JAVELIN") return event;
  return null;
}

// POST /api/throws/logs — log throws for a block (batch create/upsert)
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const parsed = await parseBody(req, ThrowsBlockLogCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { assignmentId, blockId, throws } = parsed;

    // Verify the assignment belongs to this athlete
    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: { athleteProfile: { select: { id: true } } },
    });

    if (!user?.athleteProfile) {
      return NextResponse.json(
        { success: false, error: "Athlete profile not found" },
        { status: 403 }
      );
    }

    const assignment = await prisma.throwsAssignment.findUnique({
      where: { id: assignmentId },
      include: { session: { select: { event: true } } },
    });

    if (!assignment || assignment.athleteId !== user.athleteProfile.id) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    // Resolve catalog implementId per throw (so the bulk insert lands
    // catalog-keyed). Pull event off the parent session.
    const throwType = assignment.session.event
      ? eventToImplementType(assignment.session.event)
      : null;
    const throwsWithCatalog: Array<{
      assignmentId: string;
      blockId: string;
      throwNumber: number;
      distance: number | null;
      implement: string;
      implementId: string | null;
      notes: string | null;
    }> = [];
    for (const t of throws) {
      let implementId: string | null = null;
      const kg = parseImplementKg(t.implement);
      if (throwType && kg != null && kg > 0) {
        const isLb = /lbs?\b/i.test(t.implement);
        const match = await findCatalogMatchForWeight(kg, throwType, {
          unitSystem: isLb ? "imperial" : "metric",
        });
        if (match.kind === "exact" || match.kind === "tolerated") {
          implementId = match.implement.id;
        }
      }
      throwsWithCatalog.push({
        assignmentId,
        blockId,
        throwNumber: t.throwNumber,
        distance: t.distance,
        implement: t.implement,
        implementId,
        notes: t.notes || null,
      });
    }

    // Atomically delete existing logs and create fresh ones, then recompute
    // catalog PRs for every (athlete, implement) we touched.
    const result = await prisma.$transaction(
      async (tx) => {
        // Capture pre-existing implementIds so we recompute the OLD combos
        // too (covers cases where this batch replaces a different implement).
        const oldRows = await tx.throwsBlockLog.findMany({
          where: { assignmentId, blockId },
          select: { implementId: true },
        });
        const oldImplementIds = new Set(
          oldRows.map((r) => r.implementId).filter((x): x is string => x != null)
        );

        await tx.throwsBlockLog.deleteMany({ where: { assignmentId, blockId } });
        const created = await tx.throwsBlockLog.createMany({ data: throwsWithCatalog });

        // Recompute every distinct (athlete, implement) we either left or
        // arrived at — covers implement-change-on-edit.
        const allImplementIds = new Set<string>(oldImplementIds);
        for (const t of throwsWithCatalog) {
          if (t.implementId) allImplementIds.add(t.implementId);
        }
        const targets = Array.from(allImplementIds).map((implementId) => ({
          athleteId: user.athleteProfile!.id,
          implementId,
        }));
        if (targets.length > 0) {
          await recomputeManyPRs(tx, targets);
        }
        return created;
      },
      { timeout: 30_000 }
    );

    return NextResponse.json({ success: true, data: { count: result.count } });
  } catch (error) {
    logger.error("POST /api/throws/logs error", { context: "throws/logs", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/throws/logs — get throw logs for an assignment
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get("assignmentId");

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, error: "assignmentId is required" },
        { status: 400 }
      );
    }

    // Verify caller has access to this assignment's athlete
    const assignment = await prisma.throwsAssignment.findUnique({
      where: { id: assignmentId },
      select: { athleteId: true },
    });
    if (!assignment) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }
    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        assignment.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const logs = await prisma.throwsBlockLog.findMany({
      where: { assignmentId },
      orderBy: [{ blockId: "asc" }, { throwNumber: "asc" }],
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    logger.error("GET /api/throws/logs error", { context: "throws/logs", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
