import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/* ─── POST — clone a workout plan ────────────────────────────────────────── */

export async function POST(
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

    // Fetch original plan with full structure
    const original = await prisma.workoutPlan.findFirst({
      where: { id: params.id, coachId: coach.id },
      include: {
        blocks: {
          orderBy: { order: "asc" },
          include: {
            exercises: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    if (!original) {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }

    // Deep clone
    const clone = await prisma.workoutPlan.create({
      data: {
        coachId: coach.id,
        name: `${original.name} (Copy)`,
        description: original.description,
        event: original.event,
        isTemplate: false, // Clones start as non-template
        blocks: {
          create: original.blocks.map((block) => ({
            name: block.name,
            order: block.order,
            blockType: block.blockType,
            restSeconds: block.restSeconds,
            notes: block.notes,
            exercises: {
              create: block.exercises.map((ex) => ({
                exerciseId: ex.exerciseId,
                order: ex.order,
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight,
                rpe: ex.rpe,
                distance: ex.distance,
                restSeconds: ex.restSeconds,
                notes: ex.notes,
                implementKg: ex.implementKg,
              })),
            },
          })),
        },
      },
      select: { id: true, name: true },
    });

    return NextResponse.json(clone, { status: 201 });
  } catch (err) {
    logger.error("POST /api/coach/plans/[id]/clone", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to clone plan." }, { status: 500 });
  }
}
