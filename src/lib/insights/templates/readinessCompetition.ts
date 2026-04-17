import type { StructuredInsight } from "../types";
import { CONFIDENCE_LABEL, EVENT_LABEL, FACTOR_LABEL } from "./shared";

export type ReadinessCompetitionEvidence = {
  factor: string;
  event: string;
  pairs: Array<{ competitionId: string; preAvg: number; bestMarkDeltaM: number }>;
  pearsonR: number;
  belowMedianMeanDelta: number;
  aboveMedianMeanDelta: number;
};

export function renderReadinessCompetition(
  insight: StructuredInsight<ReadinessCompetitionEvidence>
): { title: string; body: string; detail: string } {
  const eventLabel = EVENT_LABEL[insight.event ?? ""] ?? "event";
  const factorKey = String(insight.renderInputs.factor);
  const factorLabel = FACTOR_LABEL[factorKey] ?? factorKey;
  const threshold = String(insight.renderInputs.thresholdLabel);
  const direction = String(insight.renderInputs.direction);
  const meters = Math.abs(insight.effectSize ?? 0).toFixed(1);
  const lowerEvent = eventLabel.toLowerCase();

  const title = `${factorLabel} affects your ${lowerEvent} meets`;
  const body =
    direction === "negative"
      ? `Your ${lowerEvent} meets go roughly ${meters}m worse when ${factorLabel.toLowerCase()} is ${threshold} in the 3 days before.`
      : `Your ${lowerEvent} meets go roughly ${meters}m better when ${factorLabel.toLowerCase()} is ${threshold} in the 3 days before.`;
  const detail = `Pattern strength: ${CONFIDENCE_LABEL[insight.confidenceBand]} — based on ${insight.dataPoints} competitions.`;

  return { title, body, detail };
}
