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
    const { name, description, parentTeamId, order } = parsed;

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

    // Parent change validation: 2-level cap + no self-parent + no orphaning children
    if (parentTeamId !== undefined && parentTeamId !== null) {
      if (parentTeamId === teamId) {
        return NextResponse.json(
          { success: false, error: "A group cannot be its own parent" },
          { status: 400 }
        );
      }
      const parent = await prisma.team.findFirst({
        where: { id: parentTeamId, coachId: coach.id },
        select: { id: true, parentTeamId: true },
      });
      if (!parent) {
        return NextResponse.json(
          { success: false, error: "Parent group not found" },
          { status: 404 }
        );
      }
      if (parent.parentTeamId !== null) {
        return NextResponse.json(
          { success: false, error: "Sub-groups cannot contain further sub-groups (2-level max)" },
          { status: 400 }
        );
      }
      // If THIS group has children, it cannot become a sub-group (would create grandchildren)
      const childCount = await prisma.team.count({ where: { parentTeamId: teamId } });
      if (childCount > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "This group has sub-groups and can't be moved under another group",
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description: description ?? null } : {}),
        ...(parentTeamId !== undefined ? { parentTeamId: parentTeamId ?? null } : {}),
        ...(order !== undefined && order !== null ? { order } : {}),
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
    } catch (err) {
      // Non-critical — preference cleanup is best-effort
      logger.debug("Non-critical — preference cleanup is best-effort", {
        context: "src/app/api/coach/teams/[teamId]/route.ts",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    logger.error("Error deleting team", { context: "api", error });
    return NextResponse.json({ success: false, error: "Failed to delete team" }, { status: 500 });
  }
}
