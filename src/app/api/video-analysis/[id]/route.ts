import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCoachApi } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import { deleteFile } from "@/lib/r2";

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

    // Fetch full record to get file URLs for cleanup
    const existing = await prisma.videoAnalysis.findUnique({
      where: { id },
      select: { coachId: true, videoUrl: true, thumbnailUrl: true },
    });
    if (!existing || existing.coachId !== coach.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete DB record first, then clean up files (best-effort)
    await prisma.videoAnalysis.delete({ where: { id } });

    // Clean up stored files — extract storage key from URL
    const extractKey = (url: string): string | null => {
      const match = url.match(/(video-analysis\/[^?#]+)/);
      return match ? match[1] : null;
    };

    const videoKey = extractKey(existing.videoUrl);
    if (videoKey) {
      try { await deleteFile(videoKey); } catch (err) {
        logger.error("Failed to delete video file", { context: "api", metadata: { key: videoKey }, error: err });
      }
    }
    if (existing.thumbnailUrl) {
      const thumbKey = extractKey(existing.thumbnailUrl);
      if (thumbKey) {
        try { await deleteFile(thumbKey); } catch (err) {
          logger.error("Failed to delete thumbnail file", { context: "api", metadata: { key: thumbKey }, error: err });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.name === "AuthError") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("DELETE /api/video-analysis/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to delete analysis" }, { status: 500 });
  }
}
