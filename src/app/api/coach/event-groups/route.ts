import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEventGroups, createEventGroup } from "@/lib/data/event-groups";
import type { EventType } from "@prisma/client";

const VALID_EVENT_TYPES = new Set<string>(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"]);

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

    const data = await getEventGroups(coach.id);
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
    const { name, events, color, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

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

    const data = await createEventGroup(coach.id, {
      name,
      events: events as EventType[],
      color: color ?? undefined,
      description: description ?? undefined,
    });

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    console.error("Error creating event group:", error);
    return NextResponse.json({ error: "Failed to create event group" }, { status: 500 });
  }
}
