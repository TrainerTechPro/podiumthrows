/**
 * Server-side helpers for the athlete goals page. The shape mirrors what
 * `GET /api/athlete/goals` returns so the page and client-side refetches
 * share one type.
 */

import prisma from "@/lib/prisma";
import { computeProgressPct } from "@/lib/goals/milestones";
import { generateSuggestions, type SuggestedGoal } from "@/lib/goals/suggestions";

export interface DecoratedGoal {
  id: string;
  title: string;
  description: string | null;
  targetValue: number;
  currentValue: number;
  startingValue: number | null;
  unit: string;
  event: string | null;
  deadline: string | null;
  status: string;
  celebratedMilestones: number[];
  progressPct: number;
  createdAt: string;
  projectedCompletionDate: string | null;
  daysUntilDeadline: number | null;
}

export interface GoalsPageData {
  active: DecoratedGoal[];
  achieved: DecoratedGoal[];
  abandoned: DecoratedGoal[];
  suggested: SuggestedGoal[];
}

export async function getAthleteGoalsPageData(athleteId: string): Promise<GoalsPageData> {
  const goals = await prisma.goal.findMany({
    where: { athleteId },
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

  const decorated: DecoratedGoal[] = goals.map((g) => {
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
      projectedCompletionDate = new Date(now + (remaining / ratePerDay) * 86_400_000).toISOString();
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

  const active = decorated
    .filter((g) => g.status === "ACTIVE")
    .sort((a, b) => {
      if (a.daysUntilDeadline === null) return 1;
      if (b.daysUntilDeadline === null) return -1;
      return a.daysUntilDeadline - b.daysUntilDeadline;
    });
  const achieved = decorated.filter((g) => g.status === "COMPLETED");
  const abandoned = decorated.filter((g) => g.status === "ABANDONED" || g.status === "MISSED");

  const suggested = await generateSuggestions(athleteId);

  return { active, achieved, abandoned, suggested };
}
