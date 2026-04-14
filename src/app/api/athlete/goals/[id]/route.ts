import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, GoalUpdateSchema } from "@/lib/api-schemas";

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

    // Verify ownership
    const existing = await prisma.goal.findFirst({
      where: { id: id, athleteId: athlete.id },
      select: { id: true, targetValue: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Goal not found." }, { status: 404 });
    }

    const parsed = await parseBody(req, GoalUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { currentValue, status, title, targetValue, deadline, description } = parsed;

    // Build update payload
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

    // Determine the effective target for auto-complete check
    const effectiveTarget = typeof targetValue === "number" ? targetValue : existing.targetValue;

    if (currentValue !== undefined) {
      data.currentValue = currentValue;
      // Auto-complete: if progress meets or exceeds target
      if (currentValue >= effectiveTarget && existing.status === "ACTIVE") {
        data.status = "COMPLETED";
      }
    }

    // Allow explicit status override (ACTIVE / COMPLETED / ABANDONED)
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
        createdAt: true,
      },
    });

    // Invalidate cached data so other widgets update without a page refresh
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
