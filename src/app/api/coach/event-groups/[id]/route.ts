import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateEventGroup, deleteEventGroup } from "@/lib/data/event-groups";
import type { EventType } from "@prisma/client";

const VALID_EVENT_TYPES = new Set<string>(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"]);

/* ── PUT — update an event group ── */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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
    const { name, events, color, description, order } = body;

    // Validate name if provided
    if (name !== undefined && !name?.trim()) {
      return NextResponse.json({ error: "Group name cannot be empty" }, { status: 400 });
    }

    // Validate events if provided
    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
      }
      const invalidEvents = events.filter(
        (e: unknown) => typeof e !== "string" || !VALID_EVENT_TYPES.has(e)
      );
      if (invalidEvents.length > 0) {
        return NextResponse.json(
          { error: `Invalid event type(s): ${invalidEvents.join(", ")}` },
          { status: 400 }
        );
      }
    }

    try {
      const data = await updateEventGroup(params.id, coach.id, {
        ...(name !== undefined ? { name } : {}),
        ...(events !== undefined ? { events: events as EventType[] } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(order !== undefined ? { order } : {}),
      });
      return NextResponse.json({ ok: true, data });
    } catch {
      return NextResponse.json({ error: "Event group not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("Error updating event group:", error);
    return NextResponse.json({ error: "Failed to update event group" }, { status: 500 });
  }
}

/* ── DELETE — delete an event group ── */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
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

    try {
      await deleteEventGroup(params.id, coach.id);
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Event group not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("Error deleting event group:", error);
    return NextResponse.json({ error: "Failed to delete event group" }, { status: 500 });
  }
}
