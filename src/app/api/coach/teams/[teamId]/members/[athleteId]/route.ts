import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/* ── DELETE — remove athlete from team (idempotent) ── */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string; athleteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, athleteId } = await params;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    // Verify team belongs to coach
    const team = await prisma.team.findFirst({
      where: { id: teamId, coachId: coach.id },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Delete membership (idempotent — no error if not found)
    await prisma.teamMember.deleteMany({
      where: { teamId, athleteId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error removing team member:", error);
    return NextResponse.json({ error: "Failed to remove team member" }, { status: 500 });
  }
}
