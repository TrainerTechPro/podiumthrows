import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateEventGroup, deleteEventGroup } from "@/lib/data/event-groups";
import { logger } from "@/lib/logger";
import { parseBody, CoachEventGroupUpdateSchema } from "@/lib/api-schemas";

/* ── PUT — update an event group ── */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const parsed = await parseBody(request, CoachEventGroupUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;

    try {
      const data = await updateEventGroup(id, coach.id, {
        ...(parsed.name != null ? { name: parsed.name } : {}),
        ...(parsed.events != null ? { events: parsed.events } : {}),
        ...(parsed.color != null ? { color: parsed.color } : {}),
        ...(parsed.description != null ? { description: parsed.description } : {}),
        ...(parsed.order != null ? { order: parsed.order } : {}),
      });
      return NextResponse.json({ success: true, data });
    } catch {
      return NextResponse.json({ success: false, error: "Event group not found" }, { status: 404 });
    }
  } catch (error) {
    logger.error("Error updating event group", { context: "api", error });
    return NextResponse.json(
      { success: false, error: "Failed to update event group" },
      { status: 500 }
    );
  }
}

/* ── DELETE — delete an event group ── */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    try {
      await deleteEventGroup(id, coach.id);
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ success: false, error: "Event group not found" }, { status: 404 });
    }
  } catch (error) {
    logger.error("Error deleting event group", { context: "api", error });
    return NextResponse.json(
      { success: false, error: "Failed to delete event group" },
      { status: 500 }
    );
  }
}
