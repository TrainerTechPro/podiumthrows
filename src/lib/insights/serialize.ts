import type { AthleteInsight } from "@prisma/client";
import type { AthleteInsightWire } from "./types";

/**
 * Convert a Prisma AthleteInsight row to its client-bound wire shape.
 *
 * `evidence` carries coach-only internals (session IDs, meet IDs, raw pair
 * arrays) surfaced in the Evidence drawer. It is stripped from the athlete
 * payload so the data never leaves the server for athlete-bound responses.
 */
export function toWire(
  insight: AthleteInsight,
  role: "COACH" | "ATHLETE" = "COACH"
): AthleteInsightWire {
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
    evidence: role === "COACH" ? insight.evidence : null,
    readByCoachAt: insight.readByCoachAt?.toISOString() ?? null,
    readByAthleteAt: insight.readByAthleteAt?.toISOString() ?? null,
    dismissedAt: insight.dismissedAt?.toISOString() ?? null,
    triggerKind: insight.triggerKind,
    triggerMeetId: insight.triggerMeetId,
    computedAt: insight.computedAt.toISOString(),
  };
}
