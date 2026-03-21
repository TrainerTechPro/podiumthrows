import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { removeMember } from "@/lib/data/event-groups";

/* ── DELETE — remove a member from an event group ── */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; athleteId: string } }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    try {
      await removeMember(params.id, coach.id, params.athleteId);
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Event group not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("Error removing member from event group:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
