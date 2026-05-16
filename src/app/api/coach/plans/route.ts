import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { withIdempotency } from "@/lib/idempotency";
import { parseBodyText, CoachPlanCreateSchema } from "@/lib/api-schemas";

/* ─── POST — create workout plan with blocks + exercises ─────────────────── */

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "COACH") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return withIdempotency(
    { userId: session.userId, endpoint: "/api/coach/plans", req },
    async (bodyText) => postHandler(session.userId, bodyText)
  );
}

async function postHandler(userId: string, bodyText: string): Promise<NextResponse> {
  try {
    const coach = await prisma.coachProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const parsed = parseBodyText(bodyText, CoachPlanCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { name, description, event, isTemplate, blocks } = parsed;

    const plan = await prisma.workoutPlan.create({
      data: {
        coachId: coach.id,
        name: name.trim(),
        description: description ? description.trim() || null : null,
        event: event ?? null,
        isTemplate: isTemplate === true,
        blocks: {
          create: blocks.map((block, blockIdx) => ({
            name: block.name.trim(),
            order: blockIdx,
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
          })),
        },
      },
      select: { id: true, name: true },
    });

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/coach/plans", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to create workout plan." },
      { status: 500 }
    );
  }
}
