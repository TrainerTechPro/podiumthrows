import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type RouteContext = { params: { id: string } };

/* ─── PATCH — coach updates a goal for one of their athletes ──────────────── */

export async function PATCH(req: NextRequest, { params }: RouteContext) {
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
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    // Verify ownership: goal must belong to an athlete of this coach
    const existing = await prisma.goal.findFirst({
      where: {
        id: params.id,
        athlete: { coachId: coach.id },
      },
      select: { id: true, targetValue: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Goal not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { currentValue, status, title, targetValue, deadline, description } =
      body as Record<string, unknown>;

    const data: Record<string, unknown> = {};

    if (typeof title === "string" && title.trim().length > 0) {
      data.title = title.trim();
    }
    if (typeof description === "string") {
      data.description = description.trim() || null;
    }
    if (typeof targetValue === "number" && targetValue > 0) {
      data.targetValue = targetValue;
    }
    if (typeof deadline === "string") {
      const d = deadline.length > 0 ? new Date(deadline) : null;
      if (d && isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid deadline date." }, { status: 400 });
      }
      data.deadline = d;
    }

    // Determine the effective target for auto-complete check
    const effectiveTarget =
      typeof targetValue === "number" && targetValue > 0
        ? targetValue
        : existing.targetValue;

    if (typeof currentValue === "number") {
      data.currentValue = currentValue;
      if (currentValue >= effectiveTarget && existing.status === "ACTIVE") {
        data.status = "COMPLETED";
      }
    }

    const validStatuses = ["ACTIVE", "COMPLETED", "ABANDONED"];
    if (typeof status === "string" && validStatuses.includes(status)) {
      data.status = status;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    const updated = await prisma.goal.update({
      where: { id: params.id },
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

    return NextResponse.json({
      goal: {
        ...updated,
        event: updated.event as string | null,
        status: updated.status as string,
        deadline: updated.deadline?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[PATCH /api/coach/goals/[id]]", err);
    return NextResponse.json({ error: "Failed to update goal." }, { status: 500 });
  }
}

/* ─── DELETE — coach abandons a goal for one of their athletes ────────────── */

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
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
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const existing = await prisma.goal.findFirst({
      where: {
        id: params.id,
        athlete: { coachId: coach.id },
      },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Goal not found." }, { status: 404 });
    }

    await prisma.goal.update({
      where: { id: params.id },
      data: { status: "ABANDONED" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/coach/goals/[id]]", err);
    return NextResponse.json({ error: "Failed to delete goal." }, { status: 500 });
  }
}
