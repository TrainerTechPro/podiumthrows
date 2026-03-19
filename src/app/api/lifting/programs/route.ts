import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/* ─── GET — list all lifting programs for the authenticated coach ──────── */

export async function GET() {
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

    const programs = await prisma.liftingProgram.findMany({
      where: { coachId: coach.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            phases: true,
            workoutLogs: true,
          },
        },
      },
    });

    return NextResponse.json(programs);
  } catch (err) {
    logger.error("GET /api/lifting/programs", { context: "api", error: err });
    return NextResponse.json(
      { error: "Failed to fetch lifting programs." },
      { status: 500 }
    );
  }
}

/* ─── POST — create program with nested phases and exercises ───────────── */

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const {
      name,
      goals,
      workoutsPerWeek,
      totalWeeks,
      rpeTargets,
      startDate,
      phases,
    } = body as Record<string, unknown>;

    // Validate required fields
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Program name is required." },
        { status: 400 }
      );
    }
    if (!Array.isArray(phases) || phases.length === 0) {
      return NextResponse.json(
        { error: "At least one phase is required." },
        { status: 400 }
      );
    }
    if (typeof workoutsPerWeek !== "number" || workoutsPerWeek < 1) {
      return NextResponse.json(
        { error: "workoutsPerWeek must be a positive number." },
        { status: 400 }
      );
    }
    if (typeof totalWeeks !== "number" || totalWeeks < 1) {
      return NextResponse.json(
        { error: "totalWeeks must be a positive number." },
        { status: 400 }
      );
    }

    // Validate phases
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i] as Record<string, unknown>;
      if (typeof phase.name !== "string" || phase.name.trim().length === 0) {
        return NextResponse.json(
          { error: `Phase ${i + 1} needs a name.` },
          { status: 400 }
        );
      }
      if (typeof phase.method !== "string" || phase.method.trim().length === 0) {
        return NextResponse.json(
          { error: `Phase ${i + 1} needs a method.` },
          { status: 400 }
        );
      }
    }

    const program = await prisma.liftingProgram.create({
      data: {
        coachId: coach.id,
        name: (name as string).trim(),
        goals: Array.isArray(goals) ? JSON.stringify(goals) : null,
        workoutsPerWeek: workoutsPerWeek as number,
        totalWeeks: totalWeeks as number,
        rpeTargets: Array.isArray(rpeTargets)
          ? JSON.stringify(rpeTargets)
          : null,
        status: "ACTIVE",
        startDate:
          typeof startDate === "string" && startDate.trim().length > 0
            ? startDate.trim()
            : null,
        phases: {
          create: (phases as Record<string, unknown>[]).map((phase, i) => ({
            name: (phase.name as string).trim(),
            method: (phase.method as string).trim(),
            startWeek: typeof phase.startWeek === "number" ? phase.startWeek : 1,
            endWeek:
              typeof phase.endWeek === "number"
                ? phase.endWeek
                : (totalWeeks as number),
            order: typeof phase.order === "number" ? phase.order : i + 1,
            exercises: {
              create: Array.isArray(phase.exercises)
                ? (phase.exercises as Record<string, unknown>[]).map((ex) => ({
                    name: (ex.name as string).trim(),
                    order: typeof ex.order === "number" ? ex.order : 1,
                    prescribedSets:
                      typeof ex.prescribedSets === "number"
                        ? ex.prescribedSets
                        : 1,
                    prescribedReps:
                      typeof ex.prescribedReps === "string"
                        ? ex.prescribedReps.trim() || null
                        : null,
                    prescribedDuration:
                      typeof ex.prescribedDuration === "string"
                        ? ex.prescribedDuration.trim() || null
                        : null,
                    prescribedLoad:
                      typeof ex.prescribedLoad === "string"
                        ? ex.prescribedLoad.trim() || null
                        : null,
                    isIsometric: ex.isIsometric === true,
                    durationProgression: ex.durationProgression
                      ? JSON.stringify(ex.durationProgression)
                      : null,
                    setsProgression: ex.setsProgression
                      ? JSON.stringify(ex.setsProgression)
                      : null,
                  }))
                : [],
            },
          })),
        },
      },
      include: {
        phases: {
          include: { exercises: true },
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(program, { status: 201 });
  } catch (err) {
    logger.error("POST /api/lifting/programs", { context: "api", error: err });
    return NextResponse.json(
      { error: "Failed to create lifting program." },
      { status: 500 }
    );
  }
}
