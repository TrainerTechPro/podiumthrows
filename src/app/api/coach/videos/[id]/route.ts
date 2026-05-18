import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError, getVideoById } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";
import { logger } from "@/lib/logger";
import { parseBody, CoachVideoUpdateSchema } from "@/lib/api-schemas";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;
    const video = await getVideoById(id, coach.id);

    if (!video) {
      return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { video } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("videos/[id] GET Error", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    // Verify ownership
    const existing = await prisma.videoUpload.findFirst({
      where: { id: id, coachId: coach.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
    }

    const parsed = await parseBody(req, CoachVideoUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { title, description, event, category, tags } = parsed;

    const data: Record<string, unknown> = {};

    if (title !== undefined) {
      data.title = title.trim();
    }
    if (description !== undefined) data.description = description?.trim() || null;
    if (event !== undefined) data.event = event ?? null;
    if (category !== undefined) data.category = category ?? null;
    if (tags !== undefined) data.tags = tags ?? [];

    await prisma.videoUpload.update({
      where: { id: id },
      data,
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("videos/[id] PUT Error", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    const video = await prisma.videoUpload.findFirst({
      where: { id: id, coachId: coach.id },
      select: { id: true, storageKey: true },
    });

    if (!video) {
      return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
    }

    // Delete from storage
    if (video.storageKey) {
      try {
        await deleteFile(video.storageKey);
      } catch {
        // Log but don't fail if storage deletion fails
        logger.error("Failed to delete video file from storage", { context: "api" });
      }
    }

    await prisma.videoUpload.delete({ where: { id: id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("videos/[id] DELETE Error", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
