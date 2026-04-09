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
      return NextResponse.json({ success: false, error:"Unauthorized" }, { status: 401 });
    }

    const { teamId, athleteId } = await params;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error:"Coach not found" }, { status: 404 });
    }

    // Verify team belongs to coach
    const team = await prisma.eventGroup.findFirst({
      where: { id: teamId, coachId: coach.id },
    });
    if (!team) {
      return NextResponse.json({ success: false, error:"Team not found" }, { status: 404 });
    }

    // Delete membership (idempotent — no error if not found)
    await prisma.eventGroupMember.deleteMany({
      where: { groupId: teamId, athleteId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error removing team member", { context: "api", error });
    return NextResponse.json({ success: false, error:"Failed to remove team member" }, { status: 500 });
  }
}
