// src/lib/insights/runInsights.ts
import { logger } from "@/lib/logger";
import { trainingPatternAnalyzer } from "./analyzers/trainingPattern";
import { liftThrowAnalyzer } from "./analyzers/liftThrowCorrelation";
import { readinessCompetitionAnalyzer } from "./analyzers/readinessCompetition";
import { renderTrainingPattern } from "./templates/trainingPattern";
import { renderLiftThrow } from "./templates/liftThrowCorrelation";
import { renderReadinessCompetition } from "./templates/readinessCompetition";
import { persistInsights } from "./persist";
import type { RenderedInsight, StructuredInsight } from "./types";

type TriggerKind = "MEET_COMPLETE" | "ON_DEMAND" | "CRON";

type AnalyzerEntry = {
  category: string;
  analyze: (athleteId: string) => Promise<StructuredInsight[]>;
  render: (s: StructuredInsight) => { title: string; body: string; detail: string };
};

const ANALYZERS: AnalyzerEntry[] = [
  {
    category: trainingPatternAnalyzer.category,
    analyze: (id) => trainingPatternAnalyzer.analyze(id) as Promise<StructuredInsight[]>,
    render: (s) => renderTrainingPattern(s as Parameters<typeof renderTrainingPattern>[0]),
  },
  {
    category: liftThrowAnalyzer.category,
    analyze: (id) => liftThrowAnalyzer.analyze(id) as Promise<StructuredInsight[]>,
    render: (s) => renderLiftThrow(s as Parameters<typeof renderLiftThrow>[0]),
  },
  {
    category: readinessCompetitionAnalyzer.category,
    analyze: (id) => readinessCompetitionAnalyzer.analyze(id) as Promise<StructuredInsight[]>,
    render: (s) =>
      renderReadinessCompetition(s as Parameters<typeof renderReadinessCompetition>[0]),
  },
];

export type RunInsightsInput = {
  athleteId: string;
  trigger: TriggerKind;
  triggerMeetId?: string;
};

export type RunInsightsResult = {
  persistedCount: number;
  skippedAnalyzers: string[];
};

export async function runInsights(input: RunInsightsInput): Promise<RunInsightsResult> {
  const rendered: Array<
    RenderedInsight & { triggerKind: TriggerKind; triggerMeetId: string | null }
  > = [];
  const skipped: string[] = [];

  for (const entry of ANALYZERS) {
    try {
      const structured = await entry.analyze(input.athleteId);
      if (structured.length === 0) {
        skipped.push(entry.category);
        continue;
      }
      for (const s of structured) {
        const { title, body, detail } = entry.render(s);
        rendered.push({
          ...s,
          title,
          body,
          detail,
          triggerKind: input.trigger,
          triggerMeetId: input.triggerMeetId ?? null,
        });
      }
    } catch (err) {
      logger.error("insight analyzer failed", {
        metadata: { category: entry.category, athleteId: input.athleteId },
        error: err,
      });
    }
  }

  const persistedCount = await persistInsights(input.athleteId, rendered);
  return { persistedCount, skippedAnalyzers: skipped };
}
