import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, LiftingProgramPatchSchema } from "@/lib/api-schemas";

/* ─── GET — full program with phases, exercises, and workout logs ──────── */

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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
      return NextResponse.json({ success: false, error: "Program not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: program });
  } catch (err) {
    logger.error("GET /api/lifting/programs/[id]", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to fetch lifting program." },
      { status: 500 }
    );
  }
}

/* ─── PATCH — update program status, name, dates ──────────────────────── */

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.liftingProgram.findFirst({
      where: { id, coachId: coach.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Program not found." }, { status: 404 });
    }

    const parsed = await parseBody(request, LiftingProgramPatchSchema);
    if (parsed instanceof NextResponse) return parsed;

    // Build update data from validated fields, trimming + null-coercing strings.
    const data: Record<string, unknown> = {};
    if (parsed.name != null) {
      const trimmed = parsed.name.trim();
      if (trimmed.length === 0) {
        return NextResponse.json(
          { success: false, error: "Program name cannot be empty." },
          { status: 400 }
        );
      }
      data.name = trimmed;
    }
    if (parsed.status != null) data.status = parsed.status;
    if (parsed.startDate !== undefined) {
      data.startDate =
        parsed.startDate != null && parsed.startDate.trim().length > 0
          ? parsed.startDate.trim()
          : null;
    }
    if (parsed.completedDate !== undefined) {
      data.completedDate =
        parsed.completedDate != null && parsed.completedDate.trim().length > 0
          ? parsed.completedDate.trim()
          : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update." },
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

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    logger.error("PATCH /api/lifting/programs/[id]", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to update lifting program." },
      { status: 500 }
    );
  }
}
