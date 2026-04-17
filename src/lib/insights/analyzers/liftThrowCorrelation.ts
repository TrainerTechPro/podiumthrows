// src/lib/insights/analyzers/liftThrowCorrelation.ts
import prisma from "@/lib/prisma";
import { pearsonCorrelation } from "@/lib/throws/profile-utils";
import {
  canonicalLift,
  estimateOneRM,
  estimateThreeRM,
  lbsToKg,
  type CanonicalLift,
} from "../rep-max";
import type { Analyzer, ConfidenceBand, InsightEvent, StructuredInsight } from "../types";
import type { LiftThrowEvidence } from "../templates/liftThrowCorrelation";

const MIN_PAIRS = 6;
const MIN_ABS_R = 0.4;
const WINDOW_DAYS = 28;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

const COMP_WEIGHT: Record<string, { male: number; female: number }> = {
  SHOT_PUT: { male: 7.26, female: 4.0 },
  DISCUS: { male: 2.0, female: 1.0 },
  HAMMER: { male: 7.26, female: 4.0 },
  JAVELIN: { male: 0.8, female: 0.6 },
};
const WEIGHT_TOLERANCE_KG = 0.05;

function bandFor(pairs: number): ConfidenceBand {
  if (pairs >= 15) return "STRONG";
  if (pairs >= 10) return "MEDIUM";
  return "WEAK";
}

function windowIndex(date: Date, anchor: number): number {
  return Math.floor((date.getTime() - anchor) / WINDOW_MS);
}

function simpleLinearSlope(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    num += dx * (ys[i] - meanY);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

export const liftThrowAnalyzer: Analyzer<LiftThrowEvidence> = {
  category: "LIFT_THROW",

  async analyze(athleteId: string): Promise<StructuredInsight<LiftThrowEvidence>[]> {
    const profile = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { gender: true, events: true },
    });
    if (!profile) return [];
    const events = (profile.events as unknown as InsightEvent[]) ?? [];
    if (events.length === 0) return [];
    const gender: "male" | "female" = profile.gender === "FEMALE" ? "female" : "male";

    const liftLogs = await prisma.liftingExerciseLog.findMany({
      where: { workoutLog: { athleteId } },
      select: {
        exerciseName: true,
        load: true,
        loadUnit: true,
        reps: true,
        sets: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    if (liftLogs.length === 0) return [];

    const earliestLiftMs = liftLogs[0].createdAt.getTime();
    const liftWindows: Record<CanonicalLift, Map<number, { max1RM: number; max3RM: number }>> = {
      BACK_SQUAT: new Map(),
      FRONT_SQUAT: new Map(),
      POWER_CLEAN: new Map(),
      SNATCH: new Map(),
      BENCH_PRESS: new Map(),
    };

    for (const log of liftLogs) {
      const canon = canonicalLift(log.exerciseName);
      if (!canon) continue;
      if (log.load == null || log.reps == null) continue;
      const weightKg = log.loadUnit === "lbs" ? lbsToKg(log.load) : log.load;
      const oneRM = estimateOneRM(weightKg, log.reps);
      const threeRM = estimateThreeRM(weightKg, log.reps);
      if (oneRM === 0) continue;
      const idx = windowIndex(log.createdAt, earliestLiftMs);
      const existing = liftWindows[canon].get(idx);
      if (!existing) {
        liftWindows[canon].set(idx, { max1RM: oneRM, max3RM: threeRM });
      } else {
        if (oneRM > existing.max1RM) existing.max1RM = oneRM;
        if (threeRM > existing.max3RM) existing.max3RM = threeRM;
      }
    }

    const allThrows = await prisma.throwLog.findMany({
      where: { athleteId, distance: { not: null } },
      select: {
        event: true,
        distance: true,
        implementWeight: true,
        date: true,
        isFoul: true,
        isPass: true,
      },
      orderBy: { date: "asc" },
    });

    const throwWindows: Partial<Record<InsightEvent, Map<number, number>>> = {};
    for (const event of events) {
      throwWindows[event] = new Map<number, number>();
      const compWeight = COMP_WEIGHT[event]?.[gender] ?? 0;
      for (const t of allThrows) {
        if (t.event !== event) continue;
        if (t.isFoul || t.isPass || t.distance == null) continue;
        if (Math.abs(t.implementWeight - compWeight) >= WEIGHT_TOLERANCE_KG) continue;
        const idx = windowIndex(t.date, earliestLiftMs);
        const existing = throwWindows[event]!.get(idx);
        if (existing == null || t.distance > existing) {
          throwWindows[event]!.set(idx, t.distance);
        }
      }
    }

    const results: StructuredInsight<LiftThrowEvidence>[] = [];

    for (const canon of Object.keys(liftWindows) as CanonicalLift[]) {
      const liftMap = liftWindows[canon];
      if (liftMap.size === 0) continue;

      for (const event of events) {
        const throwMap = throwWindows[event];
        if (!throwMap || throwMap.size === 0) continue;

        const pairedIndexes = [...liftMap.keys()]
          .filter((k) => throwMap.has(k))
          .sort((a, b) => a - b);
        if (pairedIndexes.length < MIN_PAIRS) continue;

        const one = pairedIndexes.map((i) => liftMap.get(i)!.max1RM);
        const three = pairedIndexes.map((i) => liftMap.get(i)!.max3RM);
        const throws = pairedIndexes.map((i) => throwMap.get(i)!);

        const r1 = pearsonCorrelation(one, throws) ?? 0;
        const r3 = pearsonCorrelation(three, throws) ?? 0;
        const useThreeRM = Math.abs(r3) > Math.abs(r1);
        const chosenR = useThreeRM ? r3 : r1;
        if (Math.abs(chosenR) < MIN_ABS_R) continue;

        const xs = useThreeRM ? three : one;
        const slope = simpleLinearSlope(xs, throws);

        const pairs = pairedIndexes.map((i, srcIdx) => ({
          windowStart: new Date(earliestLiftMs + i * WINDOW_MS).toISOString(),
          repMaxKg: useThreeRM ? three[srcIdx] : one[srcIdx],
          bestMarkM: throws[srcIdx],
        }));

        results.push({
          category: "LIFT_THROW",
          metric: `${canon.toLowerCase()}_${useThreeRM ? "3rm" : "1rm"}.${event.toLowerCase()}`,
          event,
          confidenceBand: bandFor(pairedIndexes.length),
          dataPoints: pairedIndexes.length,
          coefficient: chosenR,
          effectSize: slope,
          effectUnit: "meters per kg",
          evidence: {
            lift: canon,
            event,
            repMaxBasis: useThreeRM ? "3RM" : "1RM",
            pairs,
            pearsonR: chosenR,
            regressionSlope: slope,
          },
          renderInputs: { lift: canon, repMaxBasis: useThreeRM ? "3RM" : "1RM" },
        });
      }
    }

    return results;
  },
};
