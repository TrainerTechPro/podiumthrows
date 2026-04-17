import type { AthleteInsight } from "@prisma/client";
import type { AthleteInsightWire } from "./types";

/**
 * Convert a Prisma AthleteInsight row to its client-bound wire shape.
 * All `Date` fields become ISO strings; everything else is passed through.
 */
export function toWire(insight: AthleteInsight): AthleteInsightWire {
  return {
    id: insight.id,
    athleteId: insight.athleteId,
    category: insight.category,
    metric: insight.metric,
    event: insight.event,
    title: insight.title,
    body: insight.body,
    detail: insight.detail,
    confidenceBand: insight.confidenceBand,
    dataPoints: insight.dataPoints,
    coefficient: insight.coefficient,
    effectSize: insight.effectSize,
    effectUnit: insight.effectUnit,
    evidence: insight.evidence,
    readByCoachAt: insight.readByCoachAt?.toISOString() ?? null,
    readByAthleteAt: insight.readByAthleteAt?.toISOString() ?? null,
    dismissedAt: insight.dismissedAt?.toISOString() ?? null,
    triggerKind: insight.triggerKind,
    triggerMeetId: insight.triggerMeetId,
    computedAt: insight.computedAt.toISOString(),
  };
}
