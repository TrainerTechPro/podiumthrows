/**
 * "Suggested goals" generator — proposes up to 3 goals an athlete can accept
 * with one tap. Pulls from their primary event, current PR, and training
 * cadence to make the suggestions feel earned, not generic.
 */

import prisma from "@/lib/prisma";
import { EventType } from "@prisma/client";

const PRIMARY_EVENT_LOOKBACK_DAYS = 60;
const SESSIONS_PER_WEEK_TARGET = 4;
const PR_BUMP_PERCENT = 0.08; // +8% over current best — ambitious but plausible

export interface SuggestedGoal {
  /** Stable id for client-side dedupe — built from kind + event. */
  key: string;
  kind: "PR" | "CONSISTENCY" | "STRENGTH";
  title: string;
  description: string;
  targetValue: number;
  unit: string;
  event: EventType | null;
  /** Suggested deadline — ISO date string (YYYY-MM-DD), 8 weeks out. */
  deadline: string;
  /** Optional baseline from the athlete's current best. */
  startingValue?: number | null;
}

const eventLabel: Record<EventType, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

function eightWeeksOut(): string {
  const d = new Date();
  d.setDate(d.getDate() + 56);
  return d.toISOString().slice(0, 10);
}

function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

/**
 * Pulls the athlete's primary event from their most recent throws sessions.
 * Falls back to AthleteProfile.primaryEvent when no sessions exist. Returns
 * null when no signal is available — the caller should skip PR suggestions.
 */
async function findPrimaryEvent(athleteId: string): Promise<EventType | null> {
  const since = new Date();
  since.setDate(since.getDate() - PRIMARY_EVENT_LOOKBACK_DAYS);

  const sessions = await prisma.athleteThrowsSession.findMany({
    where: { athleteId, date: { gte: since.toISOString().slice(0, 10) } },
    select: { event: true },
    orderBy: { date: "desc" },
    take: 30,
  });

  if (sessions.length > 0) {
    // AthleteThrowsSession.event is stored as TEXT in the DB (not the
    // EventType enum) — coerce when it matches one of our known values.
    const counts = new Map<EventType, number>();
    for (const s of sessions) {
      if (!(s.event in eventLabel)) continue;
      const ev = s.event as EventType;
      counts.set(ev, (counts.get(ev) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? null;
  }

  // Fall back to the athlete's events list when there's no recent training
  // history. AthleteProfile stores `events: EventType[]` — take the first.
  const profile = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    select: { events: true },
  });
  return profile?.events?.[0] ?? null;
}

async function findCurrentPR(
  athleteId: string,
  event: EventType
): Promise<{ distance: number; implementLabel: string } | null> {
  const pr = await prisma.throwsPR.findFirst({
    where: { athleteId, event: event as unknown as string },
    orderBy: { distance: "desc" },
    select: { distance: true, implement: true },
  });
  if (!pr) return null;
  return { distance: pr.distance, implementLabel: pr.implement };
}

async function activeGoalKeys(athleteId: string): Promise<Set<string>> {
  const goals = await prisma.goal.findMany({
    where: { athleteId, status: "ACTIVE" },
    select: { unit: true, event: true, title: true },
  });
  const keys = new Set<string>();
  for (const g of goals) {
    if (g.unit === "meters" && g.event) keys.add(`pr:${g.event}`);
    if (g.unit === "sessions") keys.add("consistency");
  }
  return keys;
}

/**
 * Generate up to 3 suggestions. Returns [] when the athlete already has 3+
 * active goals (the page hides the suggestions section in that case anyway,
 * but we let the API decide).
 */
export async function generateSuggestions(athleteId: string): Promise<SuggestedGoal[]> {
  const activeCount = await prisma.goal.count({
    where: { athleteId, status: "ACTIVE" },
  });
  if (activeCount >= 3) return [];

  const existingKeys = await activeGoalKeys(athleteId);
  const suggestions: SuggestedGoal[] = [];
  const deadline = eightWeeksOut();

  const primaryEvent = await findPrimaryEvent(athleteId);

  // 1. PR bump for primary event.
  if (primaryEvent && !existingKeys.has(`pr:${primaryEvent}`)) {
    const pr = await findCurrentPR(athleteId, primaryEvent);
    if (pr) {
      const bumped = roundToHalf(pr.distance * (1 + PR_BUMP_PERCENT));
      // Only suggest if the bumped target is meaningfully above current PR
      // (avoids "PR 0.0m → goal 0.0m" for events with no recorded throws).
      if (bumped > pr.distance) {
        suggestions.push({
          key: `pr:${primaryEvent}`,
          kind: "PR",
          title: `${bumped}m ${eventLabel[primaryEvent]}`,
          description: `An 8% bump over your current best of ${pr.distance}m — challenging but in reach with focused work.`,
          targetValue: bumped,
          unit: "meters",
          event: primaryEvent,
          deadline,
          startingValue: pr.distance,
        });
      }
    } else {
      // No PR yet — suggest setting a baseline target instead of bumping.
      suggestions.push({
        key: `pr:${primaryEvent}`,
        kind: "PR",
        title: `Establish a ${eventLabel[primaryEvent]} baseline`,
        description: "Log your first competition-weight throw to set a target.",
        targetValue: 1, // placeholder — the wizard will let them edit
        unit: "meters",
        event: primaryEvent,
        deadline,
        startingValue: null,
      });
    }
  }

  // 2. Consistency goal — train 4x/week for 8 weeks (32 sessions).
  if (!existingKeys.has("consistency")) {
    suggestions.push({
      key: "consistency",
      kind: "CONSISTENCY",
      title: `Train ${SESSIONS_PER_WEEK_TARGET}x per week for 8 weeks`,
      description: "Consistency wins. 32 logged sessions over the next 8 weeks.",
      targetValue: SESSIONS_PER_WEEK_TARGET * 8,
      unit: "sessions",
      event: null,
      deadline,
      startingValue: 0,
    });
  }

  // 3. Strength baseline — generic. Only surface when we have room.
  if (suggestions.length < 3) {
    suggestions.push({
      key: "strength:custom",
      kind: "STRENGTH",
      title: "Set a strength PR",
      description: "Pick a lift (squat, bench, clean) and chase a number worth chasing.",
      targetValue: 0,
      unit: "kg",
      event: null,
      deadline,
      startingValue: null,
    });
  }

  return suggestions.slice(0, 3);
}
