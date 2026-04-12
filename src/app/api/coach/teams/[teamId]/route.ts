import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, TeamUpdateSchema } from "@/lib/api-schemas";
import type { CoachProfile, Team } from "@prisma/client";

/* ── Helper — fetch coach + verify team ownership ── */
async function getCoachTeam(
  teamId: string,
  userId: string
): Promise<{ coach: Pick<CoachProfile, "id" | "preferences">; team: Team } | null> {
  const coach = await prisma.coachProfile.findUnique({
    where: { userId },
    select: { id: true, preferences: true },
  });
  if (!coach) return null;

  const team = await prisma.team.findFirst({
    where: { id: teamId, coachId: coach.id },
  });
  if (!team) return null;

  return { coach, team };
}

/* ── PATCH — update team name/description ── */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    const ownership = await getCoachTeam(teamId, session.userId);
    if (!ownership) {
      return NextResponse.json({ success: false, error: "Team not found" }, { status: 404 });
    }
    const { coach } = ownership;

    const parsed = await parseBody(request, TeamUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { name, description } = parsed;

    // Name uniqueness check (exclude current team)
    if (name !== undefined) {
      const duplicate = await prisma.team.findFirst({
        where: {
          coachId: coach.id,
          id: { not: teamId },
          name: { equals: name, mode: "insensitive" },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: "A group with that name already exists" },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description: description ?? null } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error("Error updating team", { context: "api", error });
    return NextResponse.json({ success: false, error: "Failed to update team" }, { status: 500 });
  }
}

/* ── DELETE — delete team (cascade removes TeamMember rows, not athletes) ── */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    const ownership = await getCoachTeam(teamId, session.userId);
    if (!ownership) {
      return NextResponse.json({ success: false, error: "Team not found" }, { status: 404 });
    }
    const { coach } = ownership;

    await prisma.team.delete({ where: { id: teamId } });

    // Best-effort: clear lastTeamId preference if it pointed to the deleted team
    try {
      const prefs = JSON.parse((coach.preferences as string | null) ?? "{}");
      if (prefs.lastTeamId === teamId) {
        prefs.lastTeamId = null;
        await prisma.coachProfile.update({
          where: { id: coach.id },
          data: { preferences: JSON.stringify(prefs) },
        });
      }
    } catch {
      // Non-critical — preference cleanup is best-effort
    }

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    logger.error("Error deleting team", { context: "api", error });
    return NextResponse.json({ success: false, error: "Failed to delete team" }, { status: 500 });
  }
}
