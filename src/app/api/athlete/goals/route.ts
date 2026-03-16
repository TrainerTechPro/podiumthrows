import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import type { EventType } from "@prisma/client";

/* ─── GET — list athlete's own goals ──────────────────────────────────────── */

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const goals = await prisma.goal.findMany({
      where: { athleteId: athlete.id },
      orderBy: [{ status: "asc" }, { deadline: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
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

    const now = Date.now();

    const data = goals.map((g) => {
      const baseline = g.startingValue ?? 0;
      const range = g.targetValue - baseline;
      const gained = g.currentValue - baseline;
      const progressPct =
        range > 0 ? Math.min(100, Math.max(0, Math.round((gained / range) * 100))) : 0;

      let projectedCompletionDate: string | null = null;
      const daysElapsed = (now - g.createdAt.getTime()) / 86_400_000;
      const remaining = g.targetValue - g.currentValue;
      if (g.startingValue !== null && daysElapsed > 0 && gained > 0 && remaining > 0) {
        const ratePerDay = gained / daysElapsed;
        projectedCompletionDate = new Date(
          now + (remaining / ratePerDay) * 86_400_000
        ).toISOString();
      }

      return {
        id: g.id,
        title: g.title,
        description: g.description,
        targetValue: g.targetValue,
        currentValue: g.currentValue,
        startingValue: g.startingValue,
        unit: g.unit,
        event: g.event as string | null,
        deadline: g.deadline?.toISOString() ?? null,
        status: g.status as string,
        progressPct,
        createdAt: g.createdAt.toISOString(),
        projectedCompletionDate,
      };
    });

    return NextResponse.json({ goals: data });
  } catch (err) {
    logger.error("GET /api/athlete/goals", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to fetch goals." }, { status: 500 });
  }
}

/* ─── POST — create a new goal ────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { title, targetValue, unit, deadline, startingValue, description, event } =
      body as Record<string, unknown>;

    if (typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    if (typeof targetValue !== "number" || targetValue <= 0) {
      return NextResponse.json({ error: "Target value must be a positive number." }, { status: 400 });
    }
    if (typeof unit !== "string" || unit.trim().length === 0) {
      return NextResponse.json({ error: "Unit is required." }, { status: 400 });
    }

    const deadlineDate =
      typeof deadline === "string" && deadline.length > 0 ? new Date(deadline) : null;
    if (deadlineDate && isNaN(deadlineDate.getTime())) {
      return NextResponse.json({ error: "Invalid deadline date." }, { status: 400 });
    }

    const starting =
      typeof startingValue === "number" ? startingValue : null;

    const goal = await prisma.goal.create({
      data: {
        athleteId: athlete.id,
        title: title.trim(),
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
    logger.error("POST /api/athlete/goals", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to create goal." }, { status: 500 });
  }
}
