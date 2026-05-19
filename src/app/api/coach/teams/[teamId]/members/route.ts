import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, TeamAddMembersSchema } from "@/lib/api-schemas";

/* ── POST — add athletes to a team (idempotent) ── */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

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

    const parsed = await parseBody(request, TeamAddMembersSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { athleteIds } = parsed;

    // Verify all athletes belong to this coach
    const athletes = await prisma.athleteProfile.findMany({
      where: { id: { in: athleteIds }, coachId: coach.id },
      select: { id: true },
    });

    const result = await prisma.teamMember.createMany({
      data: athletes.map((a) => ({ teamId, athleteId: a.id })),
      skipDuplicates: true,
    });

    return NextResponse.json({ success: true, data: { added: result.count } });
  } catch (error) {
    logger.error("Error adding team members", { context: "api", error });
    return NextResponse.json({ success: false, error: "Couldn’t add team members" }, { status: 500 });
  }
}
