import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { parseBody, CoachDrillUpdateSchema } from "@/lib/api-schemas";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachSession();
    const { id } = await params;

    // Verify ownership — can only edit own drills
    const existing = await prisma.drill.findUnique({
      where: { id: id },
      select: { coachId: true, isGlobal: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Drill not found" }, { status: 404 });
    }
    if (existing.isGlobal || existing.coachId !== coach.id) {
      return NextResponse.json(
        { success: false, error: "Cannot edit this drill" },
        { status: 403 }
      );
    }

    const parsed = await parseBody(req, CoachDrillUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const {
      name,
      description,
      videoUrl,
      event,
      category,
      implementKg,
      difficulty,
      cues,
      athleteTypes,
    } = parsed;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl?.trim() || null;
    if (event !== undefined) updateData.event = event ?? null;
    if (category !== undefined) updateData.category = category;
    if (implementKg !== undefined) updateData.implementKg = implementKg ?? null;
    if (difficulty !== undefined) updateData.difficulty = difficulty ?? null;
    if (cues !== undefined) updateData.cues = cues?.filter((c) => c.trim()) ?? [];
    if (athleteTypes !== undefined) updateData.athleteTypes = athleteTypes ?? [];

    const drill = await prisma.drill.update({
      where: { id: id },
      data: updateData as never,
    });

    return NextResponse.json({ success: true, data: { drill } });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachSession();
    const { id } = await params;

    // Verify ownership
    const existing = await prisma.drill.findUnique({
      where: { id: id },
      select: { coachId: true, isGlobal: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Drill not found" }, { status: 404 });
    }
    if (existing.isGlobal || existing.coachId !== coach.id) {
      return NextResponse.json(
        { success: false, error: "Cannot delete this drill" },
        { status: 403 }
      );
    }

    await prisma.drill.delete({ where: { id: id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}
