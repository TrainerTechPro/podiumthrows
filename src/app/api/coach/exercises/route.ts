import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const VALID_CATEGORIES = ["CE", "SDE", "SPE", "GPE"];
const VALID_EVENTS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];

/* ─── POST — create custom exercise ──────────────────────────────────────── */

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const { name, description, category, event, implementWeight, equipment, defaultSets, defaultReps } =
      body as Record<string, unknown>;

    // Validate required fields
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (typeof category !== "string" || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    if (event !== undefined && event !== null && (typeof event !== "string" || !VALID_EVENTS.includes(event))) {
      return NextResponse.json({ error: "Invalid event." }, { status: 400 });
    }
    if (implementWeight !== undefined && implementWeight !== null && (typeof implementWeight !== "number" || implementWeight < 0)) {
      return NextResponse.json({ error: "Invalid implement weight." }, { status: 400 });
    }
    if (defaultSets !== undefined && defaultSets !== null && (typeof defaultSets !== "number" || defaultSets < 1)) {
      return NextResponse.json({ error: "Invalid default sets." }, { status: 400 });
    }

    const exercise = await prisma.exercise.create({
      data: {
        coachId: coach.id,
        name: (name as string).trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        category: category as never,
        event: event ? (event as never) : null,
        implementWeight: typeof implementWeight === "number" ? implementWeight : null,
        equipment: typeof equipment === "string" ? equipment.trim() || null : null,
        defaultSets: typeof defaultSets === "number" ? defaultSets : null,
        defaultReps: typeof defaultReps === "string" ? defaultReps.trim() || null : null,
        isGlobal: false,
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        event: true,
        implementWeight: true,
        equipment: true,
        defaultSets: true,
        defaultReps: true,
        isGlobal: true,
      },
    });

    return NextResponse.json(exercise, { status: 201 });
  } catch (err) {
    console.error("[POST /api/coach/exercises]", err);
    return NextResponse.json({ error: "Failed to create exercise." }, { status: 500 });
  }
}
