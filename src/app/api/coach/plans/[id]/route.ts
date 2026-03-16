import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

const VALID_EVENTS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];
const VALID_BLOCK_TYPES = ["throwing", "strength", "warmup", "cooldown"];

/* ─── PATCH — update workout plan ────────────────────────────────────────── */

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

    // Verify ownership
    const existing = await prisma.workoutPlan.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, description, event, isTemplate, blocks } = body as Record<string, unknown>;

    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return NextResponse.json({ error: "Plan name cannot be empty." }, { status: 400 });
    }
    if (event !== undefined && event !== null && (typeof event !== "string" || !VALID_EVENTS.includes(event))) {
      return NextResponse.json({ error: "Invalid event." }, { status: 400 });
    }

    // If blocks are provided, replace all blocks (delete + recreate)
    if (Array.isArray(blocks)) {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i] as Record<string, unknown>;
        if (typeof block.name !== "string" || block.name.trim().length === 0) {
          return NextResponse.json({ error: `Block ${i + 1} needs a name.` }, { status: 400 });
        }
        if (typeof block.blockType !== "string" || !VALID_BLOCK_TYPES.includes(block.blockType)) {
          return NextResponse.json({ error: `Block ${i + 1} has an invalid type.` }, { status: 400 });
        }
      }

      // Delete existing blocks (cascade deletes block exercises)
      await prisma.workoutBlock.deleteMany({ where: { planId: params.id } });

      // Recreate blocks
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i] as Record<string, unknown>;
        await prisma.workoutBlock.create({
          data: {
            planId: params.id,
            name: (block.name as string).trim(),
            order: i,
            blockType: block.blockType as string,
            restSeconds: typeof block.restSeconds === "number" ? block.restSeconds : null,
            notes: typeof block.notes === "string" ? block.notes.trim() || null : null,
            exercises: {
              create: Array.isArray(block.exercises)
                ? (block.exercises as Record<string, unknown>[]).map((ex, exIdx) => ({
                    exerciseId: ex.exerciseId as string,
                    order: exIdx,
                    sets: typeof ex.sets === "number" ? ex.sets : null,
                    reps: typeof ex.reps === "string" ? ex.reps.trim() || null : null,
                    weight: typeof ex.weight === "string" ? ex.weight.trim() || null : null,
                    rpe: typeof ex.rpe === "number" ? ex.rpe : null,
                    distance: typeof ex.distance === "string" ? ex.distance.trim() || null : null,
                    restSeconds: typeof ex.restSeconds === "number" ? ex.restSeconds : null,
                    notes: typeof ex.notes === "string" ? ex.notes.trim() || null : null,
                    implementKg: typeof ex.implementKg === "number" ? ex.implementKg : null,
                  }))
                : [],
            },
          },
        });
      }
    }

    // Update plan metadata
    const data: Record<string, unknown> = {};
    if (typeof name === "string") data.name = name.trim();
    if (description !== undefined) data.description = typeof description === "string" ? description.trim() || null : null;
    if (event !== undefined) data.event = event || null;
    if (isTemplate !== undefined) data.isTemplate = isTemplate === true;

    const updated = await prisma.workoutPlan.update({
      where: { id: params.id },
      data: data as never,
      select: { id: true, name: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    logger.error("PATCH /api/coach/plans/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to update plan." }, { status: 500 });
  }
}

/* ─── DELETE — delete workout plan ───────────────────────────────────────── */

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

    const plan = await prisma.workoutPlan.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: {
        id: true,
        _count: {
          select: {
            sessions: { where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] } } },
          },
        },
      },
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }
    if (plan._count.sessions > 0) {
      return NextResponse.json(
        { error: "Cannot delete a plan with active sessions. Complete or skip them first." },
        { status: 409 }
      );
    }

    await prisma.workoutPlan.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/coach/plans/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to delete plan." }, { status: 500 });
  }
}
