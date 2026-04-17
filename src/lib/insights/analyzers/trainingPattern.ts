import prisma from "@/lib/prisma";
import { computePersonalCorrelations } from "@/lib/throws/engine/personal-correlations";
import type { Analyzer, ConfidenceBand, InsightEvent, StructuredInsight } from "../types";
import type { TrainingPatternEvidence } from "../templates/trainingPattern";

const MIN_DATA_POINTS = 5;
const MIN_ABS_R = 0.4;
const TOP_N_PER_EVENT = 2;

function bandFor(dataPoints: number): ConfidenceBand {
  if (dataPoints >= 20) return "STRONG";
  if (dataPoints >= 10) return "MEDIUM";
  return "WEAK";
}

export const trainingPatternAnalyzer: Analyzer<TrainingPatternEvidence> = {
  category: "TRAINING_PATTERN",

  async analyze(athleteId: string): Promise<StructuredInsight<TrainingPatternEvidence>[]> {
    const profile = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { gender: true, events: true },
    });
    if (!profile) return [];
    const events = (profile.events as unknown as InsightEvent[]) ?? [];
    if (events.length === 0) return [];

    const results: StructuredInsight<TrainingPatternEvidence>[] = [];

    for (const event of events) {
      const sessions = await prisma.athleteThrowsSession.findMany({
        where: { athleteId, event },
        include: { drillLogs: true },
        orderBy: { date: "asc" },
      });
      if (sessions.length === 0) continue;

      // Shape into SessionExerciseRecord[] expected by computePersonalCorrelations.
      // Uses scheduledDate field name to match the engine's interface.
      const sessionHistory = sessions.map((s) => ({
        sessionId: s.id,
        scheduledDate: s.date,
        bestMark: Math.max(
          0,
          ...s.drillLogs.map((d: { bestMark?: number | null }) => d.bestMark ?? 0)
        ),
        throwCount: s.drillLogs.reduce(
          (acc: number, d: { throwCount?: number | null }) => acc + (d.throwCount ?? 0),
          0
        ),
        exercises: s.drillLogs.map((d: { drillType: string }) => d.drillType),
      }));

      // For MVP we pass empty population — engine falls back to personal-only at reduced confidence.
      // Future follow-up: plumb Volume IV population data from src/lib/throws/correlations.ts.
      const correlations = computePersonalCorrelations(sessionHistory, []);

      const qualifying = correlations
        .filter((c) => Math.abs(c.blendedR) >= MIN_ABS_R && c.dataPoints >= MIN_DATA_POINTS)
        .sort((a, b) => Math.abs(b.blendedR) - Math.abs(a.blendedR))
        .slice(0, TOP_N_PER_EVENT);

      for (const c of qualifying) {
        const direction = c.blendedR >= 0 ? "positive" : "negative";
        results.push({
          category: "TRAINING_PATTERN",
          metric: `exerciseUsage.${event}.${c.exercise}`,
          event,
          confidenceBand: bandFor(c.dataPoints),
          dataPoints: c.dataPoints,
          coefficient: c.blendedR,
          effectSize: null,
          effectUnit: null,
          evidence: {
            sessionIds: sessionHistory.slice(-10).map((s) => s.sessionId),
            event,
            exercise: c.exercise,
            personalR: c.personalR,
            populationR: c.populationR,
            blendedR: c.blendedR,
            confidence: c.confidence,
          },
          renderInputs: { exercise: c.exercise, direction },
        });
      }
    }

    return results;
  },
};
