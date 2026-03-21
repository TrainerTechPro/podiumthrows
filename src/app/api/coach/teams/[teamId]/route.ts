import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/* ── PATCH — update team name/description ── */
export async function PATCH(
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

    const team = await prisma.eventGroup.findFirst({
      where: { id: teamId, coachId: coach.id },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (name !== undefined) {
      if (!name?.trim()) {
        return NextResponse.json({ error: "Team name cannot be empty" }, { status: 400 });
      }
      if (name.trim().length > 100) {
        return NextResponse.json(
          { error: "Team name must be 100 characters or less" },
          { status: 400 }
        );
      }
      const existing = await prisma.eventGroup.findFirst({
        where: {
          coachId: coach.id,
          id: { not: teamId },
          name: { equals: name.trim(), mode: "insensitive" },
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A team with this name already exists" },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.eventGroup.update({
      where: { id: teamId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error("Error updating team:", error);
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
  }
}

/* ── DELETE — delete team (cascade removes members, not athletes) ── */
export async function DELETE(
  _request: NextRequest,
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
      select: { id: true, preferences: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const team = await prisma.eventGroup.findFirst({
      where: { id: teamId, coachId: coach.id },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    await prisma.eventGroup.delete({ where: { id: teamId } });

    // Clear lastTeamId preference if it pointed to the deleted team
    try {
      const prefs = JSON.parse(coach.preferences || "{}");
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting team:", error);
    return NextResponse.json({ error: "Failed to delete team" }, { status: 500 });
  }
}
