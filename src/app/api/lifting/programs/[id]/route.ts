import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/* ─── GET — full program with phases, exercises, and workout logs ──────── */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    const program = await prisma.liftingProgram.findFirst({
      where: { id, coachId: coach.id },
      include: {
        phases: {
          include: {
            exercises: { orderBy: { order: "asc" } },
          },
          orderBy: { order: "asc" },
        },
        workoutLogs: {
          include: {
            exerciseLogs: { orderBy: { order: "asc" } },
          },
          orderBy: [{ weekNumber: "asc" }, { workoutNumber: "asc" }],
        },
      },
    });

    if (!program) {
      return NextResponse.json(
        { error: "Program not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(program);
  } catch (err) {
    logger.error("GET /api/lifting/programs/[id]", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to fetch lifting program." },
      { status: 500 }
    );
  }
}

/* ─── PATCH — update program status, name, dates ──────────────────────── */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.liftingProgram.findFirst({
      where: { id, coachId: coach.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Program not found." },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { name, status, startDate, completedDate } = body as Record<
      string,
      unknown
    >;

    // Build update data — only allow specific fields
    const data: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Program name cannot be empty." },
          { status: 400 }
        );
      }
      data.name = name.trim();
    }

    if (status !== undefined) {
      if (
        typeof status !== "string" ||
        !["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"].includes(status)
      ) {
        return NextResponse.json(
          { error: "Invalid status. Must be ACTIVE, PAUSED, COMPLETED, or ARCHIVED." },
          { status: 400 }
        );
      }
      data.status = status;
    }

    if (startDate !== undefined) {
      data.startDate =
        typeof startDate === "string" && startDate.trim().length > 0
          ? startDate.trim()
          : null;
    }

    if (completedDate !== undefined) {
      data.completedDate =
        typeof completedDate === "string" && completedDate.trim().length > 0
          ? completedDate.trim()
          : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update." },
        { status: 400 }
      );
    }

    const updated = await prisma.liftingProgram.update({
      where: { id },
      data: data as never,
      include: {
        phases: {
          include: { exercises: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    logger.error("PATCH /api/lifting/programs/[id]", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to update lifting program." },
      { status: 500 }
    );
  }
}
