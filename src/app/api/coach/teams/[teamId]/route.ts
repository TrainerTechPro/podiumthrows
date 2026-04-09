import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/* ── PATCH — update team name/description ── */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error:"Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error:"Coach not found" }, { status: 404 });
    }

    const team = await prisma.eventGroup.findFirst({
      where: { id: teamId, coachId: coach.id },
    });
    if (!team) {
      return NextResponse.json({ success: false, error:"Team not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (name !== undefined) {
      if (!name?.trim()) {
        return NextResponse.json({ success: false, error:"Team name cannot be empty" }, { status: 400 });
      }
      if (name.trim().length > 100) {
        return NextResponse.json(
          { success: false, error:"Team name must be 100 characters or less" },
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
          { success: false, error:"A team with this name already exists" },
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

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error("Error updating team", { context: "api", error });
    return NextResponse.json({ success: false, error:"Failed to update team" }, { status: 500 });
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
      return NextResponse.json({ success: false, error:"Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, preferences: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error:"Coach not found" }, { status: 404 });
    }

    const team = await prisma.eventGroup.findFirst({
      where: { id: teamId, coachId: coach.id },
    });
    if (!team) {
      return NextResponse.json({ success: false, error:"Team not found" }, { status: 404 });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error deleting team", { context: "api", error });
    return NextResponse.json({ success: false, error:"Failed to delete team" }, { status: 500 });
  }
}
