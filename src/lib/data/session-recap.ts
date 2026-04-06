/**
 * Session Recap — shared data computation.
 *
 * Used by BOTH the /api/athlete/session-recap/[sessionId] GET route AND
 * the athlete/sessions/[id]/recap server page so the full payload is
 * computed from a single source of truth.
 */

import prisma from "@/lib/prisma";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type WellnessValue = 1 | 2 | 3;

export type WellnessCheckin = {
  legs: WellnessValue;
  energy: WellnessValue;
  focus: WellnessValue;
  submittedAt: string;
};

export type SessionRecap = {
  session: {
    id: string;
    scheduledDate: string;
    completedDate: string | null;
    status: string;
    rpe: number | null;
    notes: string | null;
  };
  summary: {
    totalThrows: number;
    bestThrow: {
      distance: number;
      event: string;
      implementWeight: number;
      rpe: number | null;
      isPersonalBest: boolean;
    } | null;
    averageDistance: number | null;
    implementsUsed: Array<{ event: string; weightKg: number; count: number }>;
  };
  personalRecords: Array<{
    throwLogId: string;
    event: string;
    implementWeight: number;
    newDistance: number;
    previousDistance: number | null;
    delta: number | null;
    isFirstAttempt: boolean;
    scope: "ALL_TIME";
  }>;
  lastSessionComparison: {
    previousSessionDate: string | null;
    throwCountDelta: number;
    averageDistanceDelta: number | null;
  } | null;
  streak: {
    current: number;
    longest: number;
    isActiveToday: boolean;
  };
  topThrow: {
    id: string;
    distance: number;
    event: string;
    implementWeight: number;
    rpe: number | null;
    isPersonalBest: boolean;
    shareText: string;
  } | null;
  wellnessCheckin: WellnessCheckin | null;
};

type ThrowRow = {
  id: string;
  event: string;
  implementWeight: number;
  distance: number | null;
  rpe: number | null;
  isPersonalBest: boolean;
  date: Date;
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function parseWellnessCheckin(value: unknown): WellnessCheckin | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const legs = Number(v.legs);
  const energy = Number(v.energy);
  const focus = Number(v.focus);
  const submittedAt = typeof v.submittedAt === "string" ? v.submittedAt : null;
  if (
    ![1, 2, 3].includes(legs) ||
    ![1, 2, 3].includes(energy) ||
    ![1, 2, 3].includes(focus) ||
    !submittedAt
  ) {
    return null;
  }
  return {
    legs: legs as WellnessValue,
    energy: energy as WellnessValue,
    focus: focus as WellnessValue,
    submittedAt,
  };
}

function formatEventLabel(event: string): string {
  const labels: Record<string, string> = {
    SHOT_PUT: "Shot Put",
    DISCUS: "Discus",
    HAMMER: "Hammer",
    JAVELIN: "Javelin",
  };
  return labels[event] ?? event;
}

function buildShareText(throwRow: ThrowRow): string {
  const distance = throwRow.distance ?? 0;
  return `${distance.toFixed(2)}m — ${formatEventLabel(throwRow.event)} (${throwRow.implementWeight}kg) #podiumthrows`;
}

/* ─── Main ───────────────────────────────────────────────────────────────── */

/**
 * Returns a fully-computed SessionRecap for the given (athlete, session).
 * Caller is responsible for ownership verification via the athleteId filter.
 * Returns null if the session does not exist or does not belong to the athlete.
 */
export async function computeSessionRecap(
  athleteId: string,
  sessionId: string
): Promise<SessionRecap | null> {
  const athlete = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    select: {
      currentStreak: true,
      longestStreak: true,
      lastActivityDate: true,
    },
  });
  if (!athlete) return null;

  const targetSession = await prisma.trainingSession.findFirst({
    where: { id: sessionId, athleteId },
    select: {
      id: true,
      scheduledDate: true,
      completedDate: true,
      status: true,
      rpe: true,
      notes: true,
      wellnessCheckin: true,
      throwLogs: {
        select: {
          id: true,
          event: true,
          implementWeight: true,
          distance: true,
          rpe: true,
          isPersonalBest: true,
          date: true,
        },
        orderBy: { date: "asc" },
      },
    },
  });

  if (!targetSession) return null;

  const throws = targetSession.throwLogs as ThrowRow[];
  const throwsWithDistance = throws.filter(
    (t): t is ThrowRow & { distance: number } => t.distance != null
  );

  // Summary totals
  const totalThrows = throws.length;
  const averageDistance = average(throwsWithDistance.map((t) => t.distance));

  const bestThrowRow = throwsWithDistance.reduce<(ThrowRow & { distance: number }) | null>(
    (best, t) => (best == null || t.distance > best.distance ? t : best),
    null
  );

  const implementMap = new Map<string, { event: string; weightKg: number; count: number }>();
  for (const t of throws) {
    const key = `${t.event}:${t.implementWeight}`;
    const existing = implementMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      implementMap.set(key, { event: t.event, weightKg: t.implementWeight, count: 1 });
    }
  }
  const implementsUsed = Array.from(implementMap.values()).sort(
    (a, b) => b.weightKg - a.weightKg
  );

  // Personal records — prior best excluding the current session
  const prThrows = throws.filter((t) => t.isPersonalBest && t.distance != null);

  const personalRecords = await Promise.all(
    prThrows.map(async (prThrow) => {
      const prior = await prisma.throwLog.findFirst({
        where: {
          athleteId,
          event: prThrow.event as never,
          implementWeight: prThrow.implementWeight,
          id: { not: prThrow.id },
          sessionId: { not: sessionId },
          distance: { not: null },
        },
        orderBy: { distance: "desc" },
        select: { distance: true },
      });

      const newDistance = prThrow.distance as number;
      const previousDistance = prior?.distance ?? null;
      const delta = previousDistance != null ? newDistance - previousDistance : null;

      return {
        throwLogId: prThrow.id,
        event: prThrow.event,
        implementWeight: prThrow.implementWeight,
        newDistance,
        previousDistance,
        delta,
        isFirstAttempt: previousDistance == null,
        scope: "ALL_TIME" as const,
      };
    })
  );

  // Last session comparison
  const previousSession = await prisma.trainingSession.findFirst({
    where: {
      athleteId,
      status: "COMPLETED",
      id: { not: sessionId },
      completedDate: { not: null },
    },
    orderBy: { completedDate: "desc" },
    select: {
      completedDate: true,
      throwLogs: {
        select: { distance: true },
      },
    },
  });

  let lastSessionComparison: SessionRecap["lastSessionComparison"] = null;
  if (previousSession) {
    const prevThrowCount = previousSession.throwLogs.length;
    const prevDistances = previousSession.throwLogs
      .map((t) => t.distance)
      .filter((d): d is number => d != null);
    const prevAverage = average(prevDistances);

    lastSessionComparison = {
      previousSessionDate: previousSession.completedDate?.toISOString() ?? null,
      throwCountDelta: totalThrows - prevThrowCount,
      averageDistanceDelta:
        averageDistance != null && prevAverage != null
          ? averageDistance - prevAverage
          : null,
    };
  }

  // Top throw — highest RPE, fallback to highest distance
  const topThrowRow =
    throwsWithDistance.reduce<(ThrowRow & { distance: number }) | null>((top, t) => {
      if (top == null) return t;
      const topRpe = top.rpe ?? -1;
      const tRpe = t.rpe ?? -1;
      if (tRpe !== topRpe) return tRpe > topRpe ? t : top;
      return t.distance > top.distance ? t : top;
    }, null) ?? bestThrowRow;

  const topThrow =
    topThrowRow != null
      ? {
          id: topThrowRow.id,
          distance: topThrowRow.distance,
          event: topThrowRow.event,
          implementWeight: topThrowRow.implementWeight,
          rpe: topThrowRow.rpe,
          isPersonalBest: topThrowRow.isPersonalBest,
          shareText: buildShareText(topThrowRow),
        }
      : null;

  // Streak — is today counted?
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isActiveToday =
    athlete.lastActivityDate != null && athlete.lastActivityDate >= today;

  const wellnessCheckin = parseWellnessCheckin(targetSession.wellnessCheckin);

  return {
    session: {
      id: targetSession.id,
      scheduledDate: targetSession.scheduledDate.toISOString(),
      completedDate: targetSession.completedDate?.toISOString() ?? null,
      status: targetSession.status,
      rpe: targetSession.rpe,
      notes: targetSession.notes,
    },
    summary: {
      totalThrows,
      bestThrow: bestThrowRow
        ? {
            distance: bestThrowRow.distance,
            event: bestThrowRow.event,
            implementWeight: bestThrowRow.implementWeight,
            rpe: bestThrowRow.rpe,
            isPersonalBest: bestThrowRow.isPersonalBest,
          }
        : null,
      averageDistance,
      implementsUsed,
    },
    personalRecords,
    lastSessionComparison,
    streak: {
      current: athlete.currentStreak,
      longest: athlete.longestStreak,
      isActiveToday,
    },
    topThrow,
    wellnessCheckin,
  };
}
