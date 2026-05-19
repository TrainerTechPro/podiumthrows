import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { removeMember } from "@/lib/data/event-groups";
import { logger } from "@/lib/logger";

/* ── DELETE — remove a member from an event group ── */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; athleteId: string }> }
) {
  try {
    const { id, athleteId } = await params;
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    try {
      await removeMember(id, coach.id, athleteId);
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ success: false, error: "Event group not found" }, { status: 404 });
    }
  } catch (error) {
    logger.error("Error removing member from event group", { context: "api", error });
    return NextResponse.json({ success: false, error: "Couldn’t remove member" }, { status: 500 });
  }
}
