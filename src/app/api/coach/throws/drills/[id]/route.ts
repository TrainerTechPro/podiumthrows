import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";

const VALID_EVENTS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];
const VALID_CATEGORIES = ["CE", "SDE", "SPE", "GPE"];
const VALID_DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const VALID_ATHLETE_TYPES = ["EXPLOSIVE", "SPEED_STRENGTH", "STRENGTH_SPEED", "STRENGTH"];

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachSession();

    // Verify ownership — can only edit own drills
    const existing = await prisma.drill.findUnique({
      where: { id: params.id },
      select: { coachId: true, isGlobal: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Drill not found" }, { status: 404 });
    }
    if (existing.isGlobal || existing.coachId !== coach.id) {
      return NextResponse.json({ error: "Cannot edit this drill" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, videoUrl, event, category, implementKg, difficulty, cues, athleteTypes } = body;

    // Validation
    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (event !== undefined && event !== null && !VALID_EVENTS.includes(event)) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }
    if (difficulty !== undefined && difficulty !== null && !VALID_DIFFICULTIES.includes(difficulty)) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
    }
    if (athleteTypes !== undefined && Array.isArray(athleteTypes)) {
      for (const at of athleteTypes) {
        if (!VALID_ATHLETE_TYPES.includes(at)) {
          return NextResponse.json({ error: `Invalid athlete type: ${at}` }, { status: 400 });
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl?.trim() || null;
    if (event !== undefined) updateData.event = event || null;
    if (category !== undefined) updateData.category = category;
    if (implementKg !== undefined) updateData.implementKg = implementKg != null ? parseFloat(implementKg) : null;
    if (difficulty !== undefined) updateData.difficulty = difficulty || null;
    if (cues !== undefined) updateData.cues = Array.isArray(cues) ? cues.filter((c: string) => c.trim()) : [];
    if (athleteTypes !== undefined) updateData.athleteTypes = Array.isArray(athleteTypes) ? athleteTypes : [];

    const drill = await prisma.drill.update({
      where: { id: params.id },
      data: updateData as never,
    });

    return NextResponse.json({ drill });
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

    // Verify ownership
    const existing = await prisma.drill.findUnique({
      where: { id: params.id },
      select: { coachId: true, isGlobal: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Drill not found" }, { status: 404 });
    }
    if (existing.isGlobal || existing.coachId !== coach.id) {
      return NextResponse.json({ error: "Cannot delete this drill" }, { status: 403 });
    }

    await prisma.drill.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
