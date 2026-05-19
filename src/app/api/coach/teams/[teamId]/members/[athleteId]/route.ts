import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/* ── DELETE — remove athlete from team (idempotent) ── */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string; athleteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, athleteId } = await params;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    // Verify team belongs to this coach
    const team = await prisma.team.findFirst({
      where: { id: teamId, coachId: coach.id },
    });
    if (!team) {
      return NextResponse.json({ success: false, error: "Team not found" }, { status: 404 });
    }

    // Delete membership — idempotent (0 deleted is not an error)
    await prisma.teamMember.deleteMany({
      where: { teamId, athleteId },
    });

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    logger.error("Error removing team member", { context: "api", error });
    return NextResponse.json({ success: false, error: "Couldn’t remove team member" }, { status: 500 });
  }
}
