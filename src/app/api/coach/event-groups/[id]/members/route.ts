import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { addMembers } from "@/lib/data/event-groups";
import { logger } from "@/lib/logger";
import { parseBody, CoachEventGroupAddMembersSchema } from "@/lib/api-schemas";

/* ── POST — add members to an event group ── */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    const parsed = await parseBody(request, CoachEventGroupAddMembersSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { athleteIds } = parsed;

    try {
      await addMembers(id, coach.id, athleteIds);
      return NextResponse.json({ success: true }, { status: 201 });
    } catch {
      return NextResponse.json({ success: false, error: "Event group not found" }, { status: 404 });
    }
  } catch (error) {
    logger.error("Error adding members to event group", { context: "api", error });
    return NextResponse.json({ success: false, error: "Couldn’t add members" }, { status: 500 });
  }
}
