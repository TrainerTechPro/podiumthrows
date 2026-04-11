import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBody, CoachNoteUpdateSchema } from "@/lib/api-schemas";
import { requireCoachAthlete } from "@/lib/data/coach";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string; noteId: string }> }
) {
  const { athleteId, noteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const note = await prisma.coachNote.findFirst({
    where: { id: noteId, athleteProfileId: athleteId, coachProfileId: ctx.coach.id },
  });
  if (!note) {
    return NextResponse.json(
      { success: false, error: "Note not found" },
      { status: 404 }
    );
  }

  const parsed = await parseBody(request, CoachNoteUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const updated = await prisma.coachNote.update({
    where: { id: noteId },
    data: {
      ...(parsed.content !== undefined ? { content: parsed.content } : {}),
      ...(parsed.category !== undefined ? { category: parsed.category } : {}),
      ...(parsed.isPrivate !== undefined ? { isPrivate: parsed.isPrivate } : {}),
    },
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ athleteId: string; noteId: string }> }
) {
  const { athleteId, noteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const note = await prisma.coachNote.findFirst({
    where: { id: noteId, athleteProfileId: athleteId, coachProfileId: ctx.coach.id },
  });
  if (!note) {
    return NextResponse.json(
      { success: false, error: "Note not found" },
      { status: 404 }
    );
  }

  await prisma.coachNote.delete({ where: { id: noteId } });

  return NextResponse.json({ success: true, data: { deleted: noteId } });
}
