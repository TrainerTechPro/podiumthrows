import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getTeamGoals } from "@/lib/data/coach";
import { parseBody, CoachGoalCreateSchema } from "@/lib/api-schemas";

/* ─── GET — fetch all goals across the coach's roster ────────────────────── */

export async function GET() {
  try {
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

    const goals = await getTeamGoals(coach.id);
    return NextResponse.json({ success: true, data: { goals } });
  } catch (err) {
    logger.error("GET /api/coach/goals", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to fetch goals." }, { status: 500 });
  }
}

/* ─── POST — coach creates a goal for one of their athletes ──────────────── */

export async function POST(req: NextRequest) {
  try {
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

    const parsed = await parseBody(req, CoachGoalCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { athleteId, title, targetValue, unit, deadline, startingValue, description, event } =
      parsed;

    // Verify coach owns this athlete
    const athlete = await prisma.athleteProfile.findFirst({
      where: { id: athleteId, coachId: coach.id },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json(
        { success: false, error: "Athlete not found or not assigned to this coach." },
        { status: 404 }
      );
    }

    const deadlineDate = deadline && deadline.length > 0 ? new Date(deadline) : null;
    if (deadlineDate && isNaN(deadlineDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid deadline date." },
        { status: 400 }
      );
    }

    const goal = await prisma.goal.create({
      data: {
        athleteId: athlete.id,
        title: title.trim(),
        description: description ? description.trim() || null : null,
        targetValue,
        currentValue: startingValue ?? 0,
        startingValue: startingValue ?? null,
        unit: unit.trim(),
        event: event ?? null,
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
        success: true,
        data: {
          goal: {
            ...goal,
            event: goal.event as string | null,
            status: goal.status as string,
            deadline: goal.deadline?.toISOString() ?? null,
            createdAt: goal.createdAt.toISOString(),
          },
        },
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("POST /api/coach/goals", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to create goal." }, { status: 500 });
  }
}
