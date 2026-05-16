import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, CoachPlanUpdateSchema } from "@/lib/api-schemas";

/* ─── PATCH — update workout plan ────────────────────────────────────────── */

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    // Verify ownership
    const existing = await prisma.workoutPlan.findFirst({
      where: { id, coachId: coach.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Plan not found." }, { status: 404 });
    }

    const parsed = await parseBody(req, CoachPlanUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { name, description, event, isTemplate, blocks } = parsed;

    const planData: Record<string, unknown> = {};
    if (typeof name === "string") planData.name = name.trim();
    if (description !== undefined)
      planData.description = description ? description.trim() || null : null;
    if (event !== undefined) planData.event = event ?? null;
    if (isTemplate !== undefined && isTemplate !== null) planData.isTemplate = isTemplate === true;

    // If blocks are provided, replace all blocks (delete + recreate)
    if (Array.isArray(blocks)) {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.workoutBlock.deleteMany({ where: { planId: id } });

        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          await tx.workoutBlock.create({
            data: {
              planId: id,
              name: block.name.trim(),
              order: i,
              blockType: block.blockType,
              restSeconds: block.restSeconds ?? null,
              notes: block.notes ? block.notes.trim() || null : null,
              exercises: {
                create: (block.exercises ?? []).map((ex, exIdx) => ({
                  exerciseId: ex.exerciseId,
                  order: exIdx,
                  sets: ex.sets ?? null,
                  reps: ex.reps ? ex.reps.trim() || null : null,
                  weight: ex.weight ? ex.weight.trim() || null : null,
                  rpe: ex.rpe ?? null,
                  distance: ex.distance ? ex.distance.trim() || null : null,
                  restSeconds: ex.restSeconds ?? null,
                  notes: ex.notes ? ex.notes.trim() || null : null,
                  implementKg: ex.implementKg ?? null,
                })),
              },
            },
          });
        }

        return tx.workoutPlan.update({
          where: { id },
          data: planData as never,
          select: { id: true, name: true },
        });
      });

      return NextResponse.json({ success: true, data: updated });
    }

    // No blocks provided — just update plan metadata
    const updated = await prisma.workoutPlan.update({
      where: { id },
      data: planData as never,
      select: { id: true, name: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    logger.error("PATCH /api/coach/plans/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to update plan." }, { status: 500 });
  }
}

/* ─── DELETE — delete workout plan ───────────────────────────────────────── */

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const plan = await prisma.workoutPlan.findFirst({
      where: { id, coachId: coach.id },
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
      return NextResponse.json({ success: false, error: "Plan not found." }, { status: 404 });
    }
    if (plan._count.sessions > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete a plan with active sessions. Complete or skip them first.",
        },
        { status: 409 }
      );
    }

    await prisma.workoutPlan.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/coach/plans/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to delete plan." }, { status: 500 });
  }
}
