// src/lib/insights/templates/trainingPattern.ts
import type { StructuredInsight } from "../types";
import { CONFIDENCE_LABEL, EVENT_LABEL, formatExerciseLabel } from "./shared";

export type TrainingPatternEvidence = {
  sessionIds: string[];
  event: string;
  exercise: string;
  personalR: number;
  populationR: number;
  blendedR: number;
  personalWeight: number;
};

export function renderTrainingPattern(insight: StructuredInsight<TrainingPatternEvidence>): {
  title: string;
  body: string;
  detail: string;
} {
  const eventLabel = EVENT_LABEL[insight.event ?? ""] ?? "event";
  const exerciseLabel = formatExerciseLabel(String(insight.renderInputs.exercise));
  const direction = String(insight.renderInputs.direction);
  const lowerEvent = eventLabel.toLowerCase();

  const title =
    direction === "positive"
      ? `Your best ${lowerEvent} throws follow ${exerciseLabel} weeks`
      : `Your ${lowerEvent} throws dip during ${exerciseLabel} weeks`;

  const body =
    direction === "positive"
      ? `Weeks with more ${exerciseLabel} sessions tend to produce your stronger throws at competition weight.`
      : `Weeks heavy on ${exerciseLabel} tend to precede your weaker sessions at competition weight.`;

  const detail = `Pattern strength: ${CONFIDENCE_LABEL[insight.confidenceBand]} — based on ${insight.dataPoints} weeks of data.`;

  return { title, body, detail };
}
