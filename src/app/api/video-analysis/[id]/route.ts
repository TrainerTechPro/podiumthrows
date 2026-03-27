import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCoachApi } from "@/lib/data/coach";
import { logger } from "@/lib/logger";

/* ── GET — fetch single analysis ── */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = params;

    const analysis = await prisma.videoAnalysis.findUnique({
      where: { id },
      include: {
        athlete: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, events: true },
        },
      },
    });

    if (!analysis || analysis.coachId !== coach.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: analysis });
  } catch (err) {
    if (err instanceof Error && err.name === "AuthError") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/video-analysis/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to fetch analysis" }, { status: 500 });
  }
}

/* ── PATCH — update analysis (annotations, key positions, metadata) ── */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = params;

    // Verify ownership
    const existing = await prisma.videoAnalysis.findUnique({
      where: { id },
      select: { coachId: true },
    });
    if (!existing || existing.coachId !== coach.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();

    // Only allow updating specific fields
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.annotations !== undefined) updateData.annotations = body.annotations;
    if (body.keyPositions !== undefined) updateData.keyPositions = body.keyPositions;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.duration !== undefined) updateData.duration = body.duration;
    if (body.fps !== undefined) updateData.fps = body.fps;

    const updated = await prisma.videoAnalysis.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    if (err instanceof Error && err.name === "AuthError") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("PATCH /api/video-analysis/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to update analysis" }, { status: 500 });
  }
}

/* ── DELETE — delete analysis ── */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = params;

    // Verify ownership
    const existing = await prisma.videoAnalysis.findUnique({
      where: { id },
      select: { coachId: true },
    });
    if (!existing || existing.coachId !== coach.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.videoAnalysis.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.name === "AuthError") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("DELETE /api/video-analysis/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to delete analysis" }, { status: 500 });
  }
}
