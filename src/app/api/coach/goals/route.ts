import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTeamGoals } from "@/lib/data/coach";
import type { EventType } from "@prisma/client";

/* ─── GET — fetch all goals across the coach's roster ────────────────────── */

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

    const goals = await getTeamGoals(coach.id);
    return NextResponse.json({ goals });
  } catch (err) {
    console.error("[GET /api/coach/goals]", err);
    return NextResponse.json({ error: "Failed to fetch goals." }, { status: 500 });
  }
}

/* ─── POST — coach creates a goal for one of their athletes ──────────────── */

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
    const { athleteId, title, targetValue, unit, deadline, startingValue, description, event } =
      body as Record<string, unknown>;

    if (typeof athleteId !== "string" || athleteId.trim().length === 0) {
      return NextResponse.json({ error: "Athlete ID is required." }, { status: 400 });
    }

    // Verify coach owns this athlete
    const athlete = await prisma.athleteProfile.findFirst({
      where: { id: athleteId, coachId: coach.id },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json(
        { error: "Athlete not found or not assigned to this coach." },
        { status: 404 }
      );
    }

    if (typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    if (typeof targetValue !== "number" || targetValue <= 0) {
      return NextResponse.json(
        { error: "Target value must be a positive number." },
        { status: 400 }
      );
    }
    if (typeof unit !== "string" || unit.trim().length === 0) {
      return NextResponse.json({ error: "Unit is required." }, { status: 400 });
    }

    const deadlineDate =
      typeof deadline === "string" && deadline.length > 0 ? new Date(deadline) : null;
    if (deadlineDate && isNaN(deadlineDate.getTime())) {
      return NextResponse.json({ error: "Invalid deadline date." }, { status: 400 });
    }

    const starting = typeof startingValue === "number" ? startingValue : null;

    const goal = await prisma.goal.create({
      data: {
        athleteId: athlete.id,
        title: (title as string).trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        targetValue: targetValue as number,
        currentValue: starting ?? 0,
        startingValue: starting,
        unit: (unit as string).trim(),
        event: typeof event === "string" && event.length > 0 ? (event as EventType) : null,
        deadline: deadlineDate,
        status: "ACTIVE",
      },
      select: {
        id: true,
        athleteId: true,
        title: true,
        targetValue: true,
        currentValue: true,
        startingValue: true,
        unit: true,
        event: true,
        deadline: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        goal: {
          ...goal,
          event: goal.event as string | null,
          status: goal.status as string,
          deadline: goal.deadline?.toISOString() ?? null,
          createdAt: goal.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/coach/goals]", err);
    return NextResponse.json({ error: "Failed to create goal." }, { status: 500 });
  }
}
