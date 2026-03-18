import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/* ── POST — add athletes to a team ── */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const team = await prisma.team.findFirst({
      where: { id: teamId, coachId: coach.id },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const body = await request.json();
    const { athleteIds } = body;

    if (!Array.isArray(athleteIds) || athleteIds.length === 0) {
      return NextResponse.json({ error: "At least one athlete ID is required" }, { status: 400 });
    }
    if (athleteIds.length > 100) {
      return NextResponse.json({ error: "Maximum 100 athletes per request" }, { status: 400 });
    }

    // Verify all athletes belong to this coach
    const athletes = await prisma.athleteProfile.findMany({
      where: { id: { in: athleteIds }, coachId: coach.id },
      select: { id: true },
    });
    const validIds = new Set(athletes.map((a) => a.id));

    // Get existing memberships to skip duplicates
    const existing = await prisma.teamMember.findMany({
      where: { teamId, athleteId: { in: athleteIds } },
      select: { athleteId: true },
    });
    const existingIds = new Set(existing.map((m) => m.athleteId));

    const toAdd = athleteIds.filter(
      (id: string) => validIds.has(id) && !existingIds.has(id)
    );

    if (toAdd.length > 0) {
      await prisma.teamMember.createMany({
        data: toAdd.map((athleteId: string) => ({ teamId, athleteId })),
      });
    }

    return NextResponse.json({ ok: true, added: toAdd.length });
  } catch (error) {
    console.error("Error adding team members:", error);
    return NextResponse.json({ error: "Failed to add team members" }, { status: 500 });
  }
}
