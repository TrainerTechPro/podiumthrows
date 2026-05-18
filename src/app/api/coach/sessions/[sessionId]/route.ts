import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, CoachSessionPatchSchema } from "@/lib/api-schemas";
import { loadCoachSessionDetail } from "@/lib/coach/load-session-detail";
import { validateFullSession } from "@/lib/bondarchuk/session-validators";

/* ─── GET — coach Session Detail DTO ───────────────────────────────────── */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const url = new URL(req.url);
    const athleteId = url.searchParams.get("athleteId");
    if (!athleteId) {
      return NextResponse.json(
        { success: false, error: "athleteId query param is required" },
        { status: 400 }
      );
    }

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

    const dto = await loadCoachSessionDetail({
      sessionId,
      athleteProfileId: athleteId,
      coachProfileId: coach.id,
    });
    if (!dto) {
      return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: dto });
  } catch (err) {
    logger.error("GET /api/coach/sessions/[sessionId]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to load session." }, { status: 500 });
  }
}

/* ─── PATCH — sparse prescription edits ────────────────────────────────── */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
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

    const parsed = await parseBody(req, CoachSessionPatchSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { blockOrder, exerciseUpdates } = parsed;

    const trainingSession = await prisma.trainingSession.findFirst({
      where: { id: sessionId, athlete: { coachId: coach.id } },
      select: {
        id: true,
        athleteId: true,
        plan: {
          select: {
            id: true,
            blocks: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                order: true,
                name: true,
                blockType: true,
                exercises: {
                  orderBy: { order: "asc" },
                  select: {
                    id: true,
                    order: true,
                    blockId: true,
                    sets: true,
                    reps: true,
                    weight: true,
                    rpe: true,
                    implementKg: true,
                    notes: true,
                    exercise: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!trainingSession || !trainingSession.plan) {
      return NextResponse.json(
        { success: false, error: "Session or plan not found." },
        { status: 404 }
      );
    }

    // Build a candidate plan by applying the requested patches in memory, then
    // run the full Bondarchuk validator before touching the DB. If invalid, we
    // 409 with the first warning so the client can surface a clean error.
    const candidate = trainingSession.plan.blocks.map((b) => ({
      id: b.id,
      order: b.order,
      name: b.name,
      blockType: b.blockType,
      exercises: b.exercises.map((e) => ({ ...e })),
    }));

    if (blockOrder && blockOrder.length > 0) {
      const indexById = new Map(blockOrder.map((id, i) => [id, i] as const));
      candidate.sort((a, b) => (indexById.get(a.id) ?? a.order) - (indexById.get(b.id) ?? b.order));
      candidate.forEach((b, i) => (b.order = i));
    }

    if (exerciseUpdates && exerciseUpdates.length > 0) {
      const exById = new Map<string, (typeof candidate)[number]["exercises"][number]>();
      for (const b of candidate) for (const e of b.exercises) exById.set(e.id, e);

      for (const u of exerciseUpdates) {
        const ex = exById.get(u.id);
        if (!ex) continue;
        if (u.blockId != null && u.blockId !== ex.blockId) {
          // Move between blocks: detach from current, attach to new candidate.
          const fromBlock = candidate.find((b) => b.id === ex.blockId);
          const toBlock = candidate.find((b) => b.id === u.blockId);
          if (fromBlock && toBlock) {
            fromBlock.exercises = fromBlock.exercises.filter((e) => e.id !== ex.id);
            ex.blockId = u.blockId;
            toBlock.exercises.push(ex);
          }
        }
        if (u.order != null) ex.order = u.order;
        if (u.sets != null) ex.sets = u.sets;
        if (u.reps !== undefined) ex.reps = u.reps ?? null;
        if (u.weight !== undefined) ex.weight = u.weight ?? null;
        if (u.rpe !== undefined) ex.rpe = u.rpe ?? null;
        if (u.implementKg !== undefined) ex.implementKg = u.implementKg ?? null;
        if (u.notes !== undefined) ex.notes = u.notes ?? null;
      }

      // Renumber order within each block to be contiguous.
      for (const b of candidate) {
        b.exercises.sort((a, b2) => a.order - b2.order);
        b.exercises.forEach((e, i) => (e.order = i));
      }
    }

    // Run Bondarchuk validator on the candidate.
    const validatorInput = candidate.map((b) => ({
      name: b.name,
      blockType: b.blockType,
      exercises: b.exercises.map((e) => ({
        name: e.exercise.name,
        implementKg: e.implementKg,
      })),
    }));
    const result = validateFullSession(validatorInput);
    // Only block on error-severity warnings (descending order + block
    // structure). Soft warnings (cross_block_ascending, weight_differential)
    // surface in the UI but must not 409 the session — they're coaching
    // notes, not structural violations.
    const firstError = result.warnings.find((w) => w.severity === "error");
    if (firstError) {
      return NextResponse.json(
        {
          success: false,
          error: firstError.message,
        },
        { status: 409 }
      );
    }

    // Apply the candidate. Atomic so a partial apply can't slip through.
    await prisma.$transaction(async (tx) => {
      if (blockOrder && blockOrder.length > 0) {
        for (let i = 0; i < candidate.length; i++) {
          await tx.workoutBlock.update({
            where: { id: candidate[i].id },
            data: { order: i },
          });
        }
      }
      if (exerciseUpdates && exerciseUpdates.length > 0) {
        for (const b of candidate) {
          for (const e of b.exercises) {
            await tx.blockExercise.update({
              where: { id: e.id },
              data: {
                blockId: e.blockId,
                order: e.order,
                sets: e.sets,
                reps: e.reps,
                weight: e.weight,
                rpe: e.rpe,
                implementKg: e.implementKg,
                notes: e.notes,
              },
            });
          }
        }
      }
    });

    revalidateTag(`athlete-${trainingSession.athleteId}`);
    revalidateTag(`coach-${coach.id}`);

    const dto = await loadCoachSessionDetail({
      sessionId,
      athleteProfileId: trainingSession.athleteId,
      coachProfileId: coach.id,
    });
    return NextResponse.json({ success: true, data: dto });
  } catch (err) {
    logger.error("PATCH /api/coach/sessions/[sessionId]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to save edits." }, { status: 500 });
  }
}
