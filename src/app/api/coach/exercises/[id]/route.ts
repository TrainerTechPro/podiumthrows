import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

const VALID_CATEGORIES = ["CE", "SDE", "SPE", "GPE"];
const VALID_EVENTS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];

/* ─── PATCH — update own exercise ────────────────────────────────────────── */

export async function PATCH(
  req: NextRequest,
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
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    // Verify ownership — can only edit own, non-global exercises
    const existing = await prisma.exercise.findFirst({
      where: { id: params.id, coachId: coach.id, isGlobal: false },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Exercise not found or not editable." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, description, category, event, implementWeight, equipment, defaultSets, defaultReps } =
      body as Record<string, unknown>;

    // Validate optional fields
    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    }
    if (category !== undefined && (typeof category !== "string" || !VALID_CATEGORIES.includes(category))) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    if (event !== undefined && event !== null && (typeof event !== "string" || !VALID_EVENTS.includes(event))) {
      return NextResponse.json({ error: "Invalid event." }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (typeof name === "string") data.name = name.trim();
    if (description !== undefined) data.description = typeof description === "string" ? description.trim() || null : null;
    if (typeof category === "string") data.category = category;
    if (event !== undefined) data.event = event || null;
    if (implementWeight !== undefined) data.implementWeight = typeof implementWeight === "number" ? implementWeight : null;
    if (equipment !== undefined) data.equipment = typeof equipment === "string" ? equipment.trim() || null : null;
    if (defaultSets !== undefined) data.defaultSets = typeof defaultSets === "number" ? defaultSets : null;
    if (defaultReps !== undefined) data.defaultReps = typeof defaultReps === "string" ? defaultReps.trim() || null : null;

    const updated = await prisma.exercise.update({
      where: { id: params.id },
      data: data as never,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        event: true,
        implementWeight: true,
        equipment: true,
        defaultSets: true,
        defaultReps: true,
        isGlobal: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    logger.error("PATCH /api/coach/exercises/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to update exercise." }, { status: 500 });
  }
}

/* ─── DELETE — delete own exercise ───────────────────────────────────────── */

export async function DELETE(
  _req: NextRequest,
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
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const existing = await prisma.exercise.findFirst({
      where: { id: params.id, coachId: coach.id, isGlobal: false },
      select: { id: true, _count: { select: { blockExercises: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Exercise not found or not deletable." }, { status: 404 });
    }
    if (existing._count.blockExercises > 0) {
      return NextResponse.json(
        { error: "Cannot delete an exercise that is used in workout plans. Remove it from all plans first." },
        { status: 409 }
      );
    }

    await prisma.exercise.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/coach/exercises/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to delete exercise." }, { status: 500 });
  }
}
