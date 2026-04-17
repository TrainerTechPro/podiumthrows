// src/lib/insights/templates/liftThrowCorrelation.ts
import type { StructuredInsight } from "../types";
import { CONFIDENCE_LABEL, EVENT_LABEL, LIFT_LABEL, effectSize } from "./shared";

export type LiftThrowEvidence = {
  lift: string;
  event: string;
  repMaxBasis: "1RM" | "3RM";
  pairs: Array<{ windowStart: string; repMaxKg: number; bestMarkM: number }>;
  pearsonR: number;
  regressionSlope: number;
};

export function renderLiftThrow(insight: StructuredInsight<LiftThrowEvidence>): {
  title: string;
  body: string;
  detail: string;
} {
  const eventLabel = EVENT_LABEL[insight.event ?? ""] ?? "event";
  const liftKey = String(insight.renderInputs.lift);
  const liftLabel = LIFT_LABEL[liftKey] ?? liftKey;
  const basis = String(insight.renderInputs.repMaxBasis) as "1RM" | "3RM";
  const lowerEvent = eventLabel.toLowerCase();
  const kgPer05m = effectSize(0.5, insight.effectSize ?? 0);

  const title = `${liftLabel} ${basis} tracks with ${lowerEvent} distance`;
  const body = `Your ${liftLabel.toLowerCase()} ${basis} and ${lowerEvent} best-mark have moved together over the last months.`;
  const detail =
    `Roughly every ${kgPer05m}kg of ${basis} has tracked with ~0.5m of ${lowerEvent} distance. ` +
    `Pattern strength: ${CONFIDENCE_LABEL[insight.confidenceBand]} — based on ${insight.dataPoints} paired windows.`;

  return { title, body, detail };
}
