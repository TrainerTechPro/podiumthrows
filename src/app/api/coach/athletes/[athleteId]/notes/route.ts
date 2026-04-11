import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBody, CoachNoteSchema } from "@/lib/api-schemas";
import { requireCoachAthlete } from "@/lib/data/coach";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  const { athleteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const parsed = await parseBody(request, CoachNoteSchema);
  if (parsed instanceof NextResponse) return parsed;

  const note = await prisma.coachNote.create({
    data: {
      coachProfileId: ctx.coach.id,
      athleteProfileId: athleteId,
      content: parsed.content,
      category: parsed.category,
      isPrivate: parsed.isPrivate,
    },
  });

  return NextResponse.json({ success: true, data: note }, { status: 201 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  const { athleteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const notes = await prisma.coachNote.findMany({
    where: { athleteProfileId: athleteId, coachProfileId: ctx.coach.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ success: true, data: notes });
}
