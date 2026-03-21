import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { addMembers } from "@/lib/data/event-groups";

/* ── POST — add members to an event group ── */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
    const { athleteIds } = body;

    if (!Array.isArray(athleteIds) || athleteIds.length === 0) {
      return NextResponse.json({ error: "athleteIds must be a non-empty array" }, { status: 400 });
    }

    try {
      await addMembers(params.id, coach.id, athleteIds as string[]);
      return NextResponse.json({ ok: true }, { status: 201 });
    } catch {
      return NextResponse.json({ error: "Event group not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("Error adding members to event group:", error);
    return NextResponse.json({ error: "Failed to add members" }, { status: 500 });
  }
}
