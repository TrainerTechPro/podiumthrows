/**
 * Computes "how close is this athlete to unlocking each insight category"
 * so the empty state can show concrete goalposts instead of the vague
 * "typically after a few weeks" copy.
 *
 * Thresholds mirror the constants inside each analyzer:
 *   - trainingPattern:        MIN_DATA_POINTS = 5 (per event)
 *   - readinessCompetition:   MIN_MEETS       = 4 (per event)
 *   - liftThrowCorrelation:   MIN_PAIRS       = 6 (paired 28-day windows)
 *
 * If you change an analyzer threshold, update this file too — there's no
 * shared source of truth yet (they're local constants in each analyzer
 * for readability).
 */

import prisma from "@/lib/prisma";

export const INSIGHT_THRESHOLDS = {
  trainingPatternSessionsPerEvent: 5,
  readinessMeetsPerEvent: 4,
  liftThrowPairedWindows: 6,
} as const;

export interface InsightProgress {
  events: string[];
  trainingPattern: {
    required: number;
    sessionsByEvent: Record<string, number>;
  };
  readinessCompetition: {
    required: number;
    meetsByEvent: Record<string, number>;
  };
  liftThrow: {
    required: number;
    pairedWindows: number;
  };
}

const WINDOW_MS = 28 * 24 * 60 * 60 * 1000;
// Loose match — the liftThrow analyzer uses canonicalLift() which covers
// back squat, front squat, power clean, snatch, bench press. For the
// progress gauge this pattern is sufficient; we're not feeding the
// correlation, only counting monthly buckets that have a qualifying lift.
const CANONICAL_LIFT_PATTERN = /(squat|clean|snatch|bench)/i;

export async function getInsightProgress(athleteId: string): Promise<InsightProgress> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    select: { events: true },
  });
  const events = ((profile?.events as string[] | null) ?? []).filter(Boolean);

  const [sessions, meets, liftLogs, throwLogs, drillLogs, practiceAttempts, blockLogs] =
    await Promise.all([
      prisma.athleteThrowsSession.findMany({
        where: { athleteId },
        select: { event: true },
      }),
      prisma.throwsCompetition.findMany({
        where: { athleteId, meetStatus: "COMPLETED" },
        select: {
          event: true,
          throws: { select: { distance: true, isFoul: true, isPass: true } },
        },
      }),
      prisma.liftingExerciseLog.findMany({
        where: { workoutLog: { athleteId } },
        select: { createdAt: true, exerciseName: true, load: true, reps: true },
      }),
      prisma.throwLog.findMany({
        where: { athleteId, distance: { not: null } },
        select: { distance: true, date: true, isFoul: true, isPass: true },
      }),
      prisma.athleteDrillLog.findMany({
        where: {
          session: { athleteId },
          bestMark: { not: null, gt: 0 },
        },
        select: { bestMark: true, session: { select: { date: true } } },
      }),
      prisma.practiceAttempt.findMany({
        where: {
          athleteId,
          distance: { not: null, gt: 0 },
        },
        select: { createdAt: true },
      }),
      prisma.throwsBlockLog.findMany({
        where: { assignment: { athleteId }, distance: { not: null, gt: 0 } },
        select: { createdAt: true },
      }),
    ]);

  // Training pattern — sessions per event
  const sessionsByEvent: Record<string, number> = {};
  for (const ev of events) sessionsByEvent[ev] = 0;
  for (const s of sessions) {
    sessionsByEvent[s.event] = (sessionsByEvent[s.event] ?? 0) + 1;
  }

  // Readiness → competition — completed meets per event with at least
  // one valid throw. Mirrors the analyzer's "usable" filter.
  const meetsByEvent: Record<string, number> = {};
  for (const ev of events) meetsByEvent[ev] = 0;
  for (const m of meets) {
    const hasValid = m.throws.some((t) => !t.isFoul && !t.isPass && t.distance != null);
    if (!hasValid) continue;
    meetsByEvent[m.event] = (meetsByEvent[m.event] ?? 0) + 1;
  }

  // Lift → throw — 28-day windows that contain BOTH a canonical lift
  // and a throw (from any source). Analyzer is stricter (per-event
  // competition-weight matching, Epley 1RM, etc.) so this is an upper
  // bound, but it gives the right directional feedback.
  const liftTimestamps: number[] = [];
  for (const l of liftLogs) {
    if (l.load == null || l.reps == null) continue;
    if (!CANONICAL_LIFT_PATTERN.test(l.exerciseName)) continue;
    liftTimestamps.push(l.createdAt.getTime());
  }
  const throwTimestamps: number[] = [];
  for (const t of throwLogs) {
    if (t.isFoul || t.isPass || t.distance == null) continue;
    throwTimestamps.push(t.date.getTime());
  }
  for (const d of drillLogs) {
    if (d.bestMark == null || d.bestMark <= 0) continue;
    throwTimestamps.push(new Date(`${d.session.date}T12:00:00`).getTime());
  }
  for (const p of practiceAttempts) throwTimestamps.push(p.createdAt.getTime());
  for (const b of blockLogs) throwTimestamps.push(b.createdAt.getTime());

  let pairedWindows = 0;
  if (liftTimestamps.length > 0 && throwTimestamps.length > 0) {
    const anchor = Math.min(...liftTimestamps);
    const liftWindows = new Set(liftTimestamps.map((t) => Math.floor((t - anchor) / WINDOW_MS)));
    const throwWindows = new Set(throwTimestamps.map((t) => Math.floor((t - anchor) / WINDOW_MS)));
    for (const w of liftWindows) if (throwWindows.has(w)) pairedWindows++;
  }

  return {
    events,
    trainingPattern: {
      required: INSIGHT_THRESHOLDS.trainingPatternSessionsPerEvent,
      sessionsByEvent,
    },
    readinessCompetition: {
      required: INSIGHT_THRESHOLDS.readinessMeetsPerEvent,
      meetsByEvent,
    },
    liftThrow: {
      required: INSIGHT_THRESHOLDS.liftThrowPairedWindows,
      pairedWindows,
    },
  };
}
