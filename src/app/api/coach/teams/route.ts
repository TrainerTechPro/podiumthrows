import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/* ── GET — list all event groups for the authenticated coach ── */
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

    const groups = await prisma.eventGroup.findMany({
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

    const data = groups.map((group) => {
      const eventBreakdown: Record<string, number> = {};
      for (const member of group.members) {
        for (const ev of member.athlete.events) {
          eventBreakdown[ev] = (eventBreakdown[ev] ?? 0) + 1;
        }
      }
      return {
        id: group.id,
        name: group.name,
        description: group.description,
        memberCount: group.members.length,
        eventBreakdown,
        createdAt: group.createdAt,
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("Error listing event groups:", error);
    return NextResponse.json({ error: "Failed to list event groups" }, { status: 500 });
  }
}

/* ── POST — create a new event group ── */
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
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }
    if (name.trim().length > 100) {
      return NextResponse.json(
        { error: "Group name must be 100 characters or less" },
        { status: 400 }
      );
    }

    // Check uniqueness (case-insensitive)
    const existing = await prisma.eventGroup.findFirst({
      where: {
        coachId: coach.id,
        name: { equals: name.trim(), mode: "insensitive" },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "A group with this name already exists" }, { status: 409 });
    }

    const group = await prisma.eventGroup.create({
      data: {
        coachId: coach.id,
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true, data: group }, { status: 201 });
  } catch (error) {
    console.error("Error creating event group:", error);
    return NextResponse.json({ error: "Failed to create event group" }, { status: 500 });
  }
}
