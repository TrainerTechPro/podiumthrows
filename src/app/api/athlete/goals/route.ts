import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, GoalCreateSchema } from "@/lib/api-schemas";
import { computeProgressPct } from "@/lib/goals/milestones";
import { generateSuggestions } from "@/lib/goals/suggestions";

/* ─── GET — active + achieved + abandoned + suggested ─────────────────────── */

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
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
        celebratedMilestones: true,
        createdAt: true,
      },
    });

    const now = Date.now();

    const decorated = goals.map((g) => {
      const progressPct = computeProgressPct({
        startingValue: g.startingValue,
        currentValue: g.currentValue,
        targetValue: g.targetValue,
      });

      let projectedCompletionDate: string | null = null;
      const daysElapsed = (now - g.createdAt.getTime()) / 86_400_000;
      const baseline = g.startingValue ?? 0;
      const gained = g.currentValue - baseline;
      const remaining = g.targetValue - g.currentValue;
      if (g.startingValue !== null && daysElapsed > 0 && gained > 0 && remaining > 0) {
        const ratePerDay = gained / daysElapsed;
        projectedCompletionDate = new Date(
          now + (remaining / ratePerDay) * 86_400_000
        ).toISOString();
      }

      const daysUntilDeadline = g.deadline
        ? Math.ceil((g.deadline.getTime() - now) / 86_400_000)
        : null;

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
        celebratedMilestones: g.celebratedMilestones,
        progressPct,
        createdAt: g.createdAt.toISOString(),
        projectedCompletionDate,
        daysUntilDeadline,
      };
    });

    // Active goals sorted by deadline proximity (no deadline → end of list).
    const active = decorated
      .filter((g) => g.status === "ACTIVE")
      .sort((a, b) => {
        if (a.daysUntilDeadline === null) return 1;
        if (b.daysUntilDeadline === null) return -1;
        return a.daysUntilDeadline - b.daysUntilDeadline;
      });
    const achieved = decorated.filter((g) => g.status === "COMPLETED");
    const abandoned = decorated.filter((g) => g.status === "ABANDONED" || g.status === "MISSED");

    const suggested = await generateSuggestions(athlete.id);

    return NextResponse.json({
      success: true,
      data: {
        active,
        achieved,
        abandoned,
        suggested,
        // Flat list kept for any legacy consumer.
        all: decorated,
      },
    });
  } catch (err) {
    logger.error("GET /api/athlete/goals", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to fetch goals." }, { status: 500 });
  }
}

/* ─── POST — create a new goal ────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, coachId: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const parsed = await parseBody(req, GoalCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { title, targetValue, unit, deadline, startingValue, description, event } = parsed;

    const deadlineDate =
      typeof deadline === "string" && deadline.length > 0 ? new Date(deadline) : null;
    if (deadlineDate && isNaN(deadlineDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid deadline date." },
        { status: 400 }
      );
    }

    const starting = typeof startingValue === "number" ? startingValue : null;

    const goal = await prisma.goal.create({
      data: {
        athleteId: athlete.id,
        title: title.trim(),
        description: description?.trim() || null,
        targetValue,
        currentValue: starting ?? 0,
        startingValue: starting,
        unit: unit.trim(),
        event: event ?? null,
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
        celebratedMilestones: true,
        createdAt: true,
      },
    });

    revalidateTag(`athlete-${athlete.id}`);
    if (athlete.coachId) revalidateTag(`coach-${athlete.coachId}`);

    return NextResponse.json(
      {
        success: true,
        data: {
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
    return NextResponse.json({ success: false, error: "Failed to create goal." }, { status: 500 });
  }
}
