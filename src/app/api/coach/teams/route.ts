import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/* ── GET — list all teams for the authenticated coach ── */
export async function GET() {
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
      orderBy: { name: "asc" },
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
        memberCount: team.members.length,
        eventBreakdown,
        createdAt: team.createdAt,
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("Error listing teams:", error);
    return NextResponse.json({ error: "Failed to list teams" }, { status: 500 });
  }
}

/* ── POST — create a new team ── */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Team name is required" }, { status: 400 });
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: "Team name must be 100 characters or less" }, { status: 400 });
    }

    // Check uniqueness (case-insensitive)
    const existing = await prisma.team.findFirst({
      where: {
        coachId: coach.id,
        name: { equals: name.trim(), mode: "insensitive" },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "A team with this name already exists" }, { status: 409 });
    }

    const team = await prisma.team.create({
      data: {
        coachId: coach.id,
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true, data: team }, { status: 201 });
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }
}
