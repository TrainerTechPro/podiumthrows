import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

const VALID_EVENTS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];
const VALID_BLOCK_TYPES = ["throwing", "strength", "warmup", "cooldown"];

/* ─── POST — create workout plan with blocks + exercises ─────────────────── */

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const { name, description, event, isTemplate, blocks } = body as Record<string, unknown>;

    // Validate required fields
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Plan name is required." }, { status: 400 });
    }
    if (event !== undefined && event !== null && (typeof event !== "string" || !VALID_EVENTS.includes(event))) {
      return NextResponse.json({ error: "Invalid event." }, { status: 400 });
    }
    if (!Array.isArray(blocks) || blocks.length === 0) {
      return NextResponse.json({ error: "At least one block is required." }, { status: 400 });
    }

    // Validate blocks
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i] as Record<string, unknown>;
      if (typeof block.name !== "string" || block.name.trim().length === 0) {
        return NextResponse.json({ error: `Block ${i + 1} needs a name.` }, { status: 400 });
      }
      if (typeof block.blockType !== "string" || !VALID_BLOCK_TYPES.includes(block.blockType)) {
        return NextResponse.json({ error: `Block ${i + 1} has an invalid type.` }, { status: 400 });
      }
    }

    // Create plan with nested blocks and exercises
    const plan = await prisma.workoutPlan.create({
      data: {
        coachId: coach.id,
        name: (name as string).trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        event: event ? (event as never) : null,
        isTemplate: isTemplate === true,
        blocks: {
          create: (blocks as Record<string, unknown>[]).map((block, blockIdx) => ({
            name: (block.name as string).trim(),
            order: blockIdx,
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
          })),
        },
      },
      select: { id: true, name: true },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    logger.error("POST /api/coach/plans", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to create workout plan." }, { status: 500 });
  }
}
