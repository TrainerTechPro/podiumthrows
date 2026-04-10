import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCoachApi } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import { deleteFile } from "@/lib/r2";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  annotations: z.array(z.record(z.string(), z.unknown())).optional(),
  keyPositions: z.array(z.record(z.string(), z.unknown())).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
  duration: z.number().positive().optional(),
  fps: z.number().positive().optional(),
}).strict();

/* ── GET — fetch single analysis ── */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    const analysis = await prisma.videoAnalysis.findUnique({
      where: { id },
      include: {
        athlete: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, events: true },
        },
      },
    });

    if (!analysis || analysis.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: analysis });
  } catch (err) {
    if (err instanceof Error && err.name === "AuthError") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/video-analysis/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to fetch analysis" }, { status: 500 });
  }
}

/* ── PATCH — update analysis (annotations, key positions, metadata) ── */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    // Verify ownership
    const existing = await prisma.videoAnalysis.findUnique({
      where: { id },
      select: { coachId: true },
    });
    if (!existing || existing.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const raw = await request.json();
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Build update with only provided fields; cast JSON arrays for Prisma
    const { annotations, keyPositions, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };
    if (annotations !== undefined) updateData.annotations = annotations;
    if (keyPositions !== undefined) updateData.keyPositions = keyPositions;

    const updated = await prisma.videoAnalysis.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof Error && err.name === "AuthError") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("PATCH /api/video-analysis/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to update analysis" }, { status: 500 });
  }
}

/* ── DELETE — delete analysis ── */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    // Fetch full record to get file URLs for cleanup
    const existing = await prisma.videoAnalysis.findUnique({
      where: { id },
      select: { coachId: true, videoUrl: true, thumbnailUrl: true },
    });
    if (!existing || existing.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
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

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.name === "AuthError") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("DELETE /api/video-analysis/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to delete analysis" }, { status: 500 });
  }
}
