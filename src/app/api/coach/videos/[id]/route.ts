import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession, getVideoById } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";

const VALID_EVENTS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];
const VALID_CATEGORIES = ["training", "competition", "drill", "analysis"];

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachSession();
    const video = await getVideoById(params.id, coach.id);

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json({ video });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachSession();

    // Verify ownership
    const existing = await prisma.videoUpload.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const body = await req.json();
    const { title, description, event, category, tags } = body as {
      title?: string;
      description?: string;
      event?: string | null;
      category?: string | null;
      tags?: string[];
    };

    const data: Record<string, unknown> = {};

    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json(
          { error: "title cannot be empty" },
          { status: 400 }
        );
      }
      data.title = title.trim();
    }
    if (description !== undefined) data.description = description?.trim() || null;
    if (event !== undefined) {
      if (event && !VALID_EVENTS.includes(event)) {
        return NextResponse.json({ error: "Invalid event" }, { status: 400 });
      }
      data.event = event || null;
    }
    if (category !== undefined) {
      if (category && !VALID_CATEGORIES.includes(category)) {
        return NextResponse.json(
          { error: "Invalid category" },
          { status: 400 }
        );
      }
      data.category = category || null;
    }
    if (tags !== undefined) data.tags = tags;

    await prisma.videoUpload.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachSession();

    const video = await prisma.videoUpload.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true, storageKey: true },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Delete from storage
    if (video.storageKey) {
      try {
        await deleteFile(video.storageKey);
      } catch {
        // Log but don't fail if storage deletion fails
        console.error("Failed to delete video file from storage");
      }
    }

    await prisma.videoUpload.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
