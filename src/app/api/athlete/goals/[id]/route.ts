import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, GoalUpdateSchema } from "@/lib/api-schemas";
import { buildCelebration, type MilestoneCelebration } from "@/lib/goals/milestones";

type RouteContext = { params: Promise<{ id: string }> };

/* ─── PATCH — update a goal (progress, title, target, status) ─────────────── */

export async function PATCH(req: NextRequest, { params }: RouteContext) {
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
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    // Verify ownership + load fields needed for milestone detection.
    const existing = await prisma.goal.findFirst({
      where: { id: id, athleteId: athlete.id },
      select: {
        id: true,
        title: true,
        unit: true,
        targetValue: true,
        currentValue: true,
        startingValue: true,
        status: true,
        celebratedMilestones: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Goal not found." }, { status: 404 });
    }

    const parsed = await parseBody(req, GoalUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { currentValue, status, title, targetValue, deadline, description } = parsed;

    const data: Record<string, unknown> = {};

    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (targetValue !== undefined) data.targetValue = targetValue;

    if (deadline !== undefined) {
      const d = deadline && deadline.length > 0 ? new Date(deadline) : null;
      if (d && isNaN(d.getTime())) {
        return NextResponse.json(
          { success: false, error: "Invalid deadline date." },
          { status: 400 }
        );
      }
      data.deadline = d;
    }

    const effectiveTarget = typeof targetValue === "number" ? targetValue : existing.targetValue;

    let celebration: MilestoneCelebration | null = null;

    if (currentValue !== undefined) {
      data.currentValue = currentValue;
      if (currentValue >= effectiveTarget && existing.status === "ACTIVE") {
        data.status = "COMPLETED";
      }

      // Compute milestone crossings against the snapshot loaded above. We
      // build the celebration record using the *new* effective target so a
      // simultaneous target lower also fires the right thresholds.
      celebration = buildCelebration(
        {
          id: existing.id,
          title: existing.title,
          unit: existing.unit,
          targetValue: effectiveTarget,
          startingValue: existing.startingValue,
          celebratedMilestones: existing.celebratedMilestones,
        },
        currentValue
      );
      if (celebration) {
        data.celebratedMilestones = Array.from(
          new Set([...existing.celebratedMilestones, ...celebration.thresholds])
        );
      }
    }

    if (status !== undefined) data.status = status;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update." },
        { status: 400 }
      );
    }

    const updated = await prisma.goal.update({
      where: { id: id },
      data,
      select: {
        id: true,
        title: true,
        targetValue: true,
        currentValue: true,
        startingValue: true,
        unit: true,
        event: true,
        deadline: true,
        status: true,
        celebratedMilestones: true,
        createdAt: true,
      },
    });

    revalidateTag(`athlete-${athlete.id}`);
    if (athlete.coachId) revalidateTag(`coach-${athlete.coachId}`);

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        event: updated.event as string | null,
        status: updated.status as string,
        deadline: updated.deadline?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
      },
      celebration,
    });
  } catch (err) {
    logger.error("PATCH /api/athlete/goals/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to update goal." }, { status: 500 });
  }
}

/* ─── DELETE — soft-delete (abandon) a goal ──────────────────────────────── */

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
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
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const existing = await prisma.goal.findFirst({
      where: { id: id, athleteId: athlete.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Goal not found." }, { status: 404 });
    }

    await prisma.goal.update({
      where: { id: id },
      data: { status: "ABANDONED" },
    });

    // Invalidate cached data so other widgets update without a page refresh
    revalidateTag(`athlete-${athlete.id}`);
    if (athlete.coachId) revalidateTag(`coach-${athlete.coachId}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/athlete/goals/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to delete goal." }, { status: 500 });
  }
}
