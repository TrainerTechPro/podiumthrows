// src/lib/insights/analyzers/readinessCompetition.ts
import prisma from "@/lib/prisma";
import { pearsonCorrelation } from "@/lib/throws/profile-utils";
import { getAthletePRs } from "@/lib/data/personal-records";
import type { Analyzer, ConfidenceBand, InsightEvent, StructuredInsight } from "../types";
import type { ReadinessCompetitionEvidence } from "../templates/readinessCompetition";

const MIN_MEETS = 4;
const MIN_ABS_R = 0.4;
const PRE_MEET_DAYS = 3;
const MIN_DAYS_COVERED = 2;

const FACTORS = [
  { key: "sleepQuality", direction: "higherIsBetter" as const },
  { key: "sleepHours", direction: "higherIsBetter" as const },
  { key: "soreness", direction: "lowerIsBetter" as const },
  { key: "stressLevel", direction: "lowerIsBetter" as const },
  { key: "energyMood", direction: "higherIsBetter" as const },
  { key: "hrvMs", direction: "higherIsBetter" as const },
  { key: "restingHR", direction: "lowerIsBetter" as const },
  { key: "whoopStrain", direction: "higherIsBetter" as const },
];

function bandFor(meets: number): ConfidenceBand {
  if (meets >= 9) return "STRONG";
  if (meets >= 6) return "MEDIUM";
  return "WEAK";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export const readinessCompetitionAnalyzer: Analyzer<ReadinessCompetitionEvidence> = {
  category: "READINESS_COMPETITION",

  async analyze(athleteId: string): Promise<StructuredInsight<ReadinessCompetitionEvidence>[]> {
    const profile = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { gender: true, events: true },
    });
    if (!profile) return [];
    const events = (profile.events as unknown as InsightEvent[]) ?? [];
    if (events.length === 0) return [];

    const competitions = await prisma.throwsCompetition.findMany({
      where: { athleteId, meetStatus: "COMPLETED" },
      include: { throws: { select: { distance: true, isFoul: true, isPass: true } } },
      orderBy: { date: "asc" },
    });
    const usable = competitions
      .map((c) => {
        const marks = c.throws
          .filter((t) => !t.isFoul && !t.isPass && t.distance != null)
          .map((t) => t.distance as number);
        if (marks.length === 0) return null;
        return {
          id: c.id,
          athleteId: c.athleteId,
          date: c.date,
          event: c.event,
          bestMark: Math.max(...marks),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (usable.length < MIN_MEETS) return [];

    const readinessRows = await prisma.readinessCheckIn.findMany({
      where: { athleteId },
      orderBy: { date: "asc" },
    });
    if (readinessRows.length === 0) return [];

    const prs = await getAthletePRs(athleteId);
    const prByEvent = new Map<string, number>();
    for (const e of prs.events) {
      if (e.competitionPR?.distance != null) prByEvent.set(e.event, e.competitionPR.distance);
    }

    const results: StructuredInsight<ReadinessCompetitionEvidence>[] = [];

    for (const event of events) {
      const eventMeets = usable.filter((m) => m.event === event);
      if (eventMeets.length < MIN_MEETS) continue;

      for (const factor of FACTORS) {
        const pairs: Array<{ competitionId: string; preAvg: number; bestMarkDeltaM: number }> = [];

        for (const m of eventMeets) {
          const meetDate = new Date(`${m.date}T00:00:00Z`);
          const windowStart = new Date(meetDate.getTime() - PRE_MEET_DAYS * 86400000);
          const windowEnd = new Date(meetDate.getTime() - 1);
          const relevant = readinessRows.filter(
            (r) => r.date >= windowStart && r.date <= windowEnd
          );
          const factorValues = relevant
            .map((r) => (r as Record<string, unknown>)[factor.key])
            .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
          if (factorValues.length < MIN_DAYS_COVERED) continue;

          const preAvg = mean(factorValues);
          const pr = prByEvent.get(event) ?? m.bestMark;
          const bestMarkDeltaM = m.bestMark - pr;
          pairs.push({ competitionId: m.id, preAvg, bestMarkDeltaM });
        }

        if (pairs.length < MIN_MEETS) continue;

        const xs = pairs.map((p) => p.preAvg);
        const ys = pairs.map((p) => p.bestMarkDeltaM);
        const r = pearsonCorrelation(xs, ys) ?? 0;
        if (Math.abs(r) < MIN_ABS_R) continue;

        const med = median(xs);
        const below = pairs.filter((p) => p.preAvg < med).map((p) => p.bestMarkDeltaM);
        const above = pairs.filter((p) => p.preAvg >= med).map((p) => p.bestMarkDeltaM);
        const belowMean = mean(below);
        const aboveMean = mean(above);
        const effect = aboveMean - belowMean;

        const positiveDirection =
          (factor.direction === "higherIsBetter" && r >= 0) ||
          (factor.direction === "lowerIsBetter" && r < 0);

        results.push({
          category: "READINESS_COMPETITION",
          metric: `${factor.key}.${event.toLowerCase()}`,
          event,
          confidenceBand: bandFor(pairs.length),
          dataPoints: pairs.length,
          coefficient: r,
          effectSize: effect,
          effectUnit: "meters",
          evidence: {
            factor: factor.key,
            event,
            pairs,
            pearsonR: r,
            belowMedianMeanDelta: belowMean,
            aboveMedianMeanDelta: aboveMean,
          },
          renderInputs: {
            factor: factor.key,
            direction: positiveDirection ? "positive" : "negative",
            thresholdLabel: positiveDirection ? "above median" : "below median",
          },
        });
      }
    }

    return results;
  },
};
