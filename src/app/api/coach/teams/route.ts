import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, TeamCreateSchema } from "@/lib/api-schemas";

/* ── GET — list all roster groups for the authenticated coach ── */
export async function GET() {
  try {
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

    const teams = await prisma.team.findMany({
      where: { coachId: coach.id },
      include: {
        members: {
          include: {
            athlete: {
              select: { events: true },
            },
          },
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    const data = teams.map((team) => {
      const eventBreakdown: Record<string, number> = {};
      for (const member of team.members) {
        for (const ev of member.athlete.events) {
          eventBreakdown[ev] = (eventBreakdown[ev] ?? 0) + 1;
        }
      }
      return {
        id: team.id,
        name: team.name,
        description: team.description,
        parentTeamId: team.parentTeamId,
        order: team.order,
        memberCount: team.members.length,
        eventBreakdown,
        createdAt: team.createdAt,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error("Error listing teams", { context: "api", error });
    return NextResponse.json({ success: false, error: "Failed to list teams" }, { status: 500 });
  }
}

/* ── POST — create a new roster group ── */
export async function POST(request: NextRequest) {
  try {
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

    const parsed = await parseBody(request, TeamCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { name, description, parentTeamId, order } = parsed;

    // Case-insensitive name uniqueness check
    const existing = await prisma.team.findFirst({
      where: {
        coachId: coach.id,
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "A group with that name already exists" },
        { status: 409 }
      );
    }

    // Parent validation: must belong to same coach AND be top-level (2-level cap)
    if (parentTeamId) {
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
    }

    const team = await prisma.team.create({
      data: {
        coachId: coach.id,
        name,
        description: description ?? null,
        parentTeamId: parentTeamId ?? null,
        order: order ?? 0,
      },
    });

    return NextResponse.json({ success: true, data: team }, { status: 201 });
  } catch (error) {
    logger.error("Error creating team", { context: "api", error });
    return NextResponse.json({ success: false, error: "Failed to create team" }, { status: 500 });
  }
}
