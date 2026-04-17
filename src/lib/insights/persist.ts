// src/lib/insights/persist.ts
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { RenderedInsight } from "./types";

type PersistItem = RenderedInsight & {
  triggerKind: "MEET_COMPLETE" | "ON_DEMAND" | "CRON";
  triggerMeetId: string | null;
};

export async function persistInsights(athleteId: string, items: PersistItem[]): Promise<number> {
  if (items.length === 0) return 0;

  const rows = items.map((i) => ({
    athleteId,
    category: i.category,
    metric: i.metric,
    event: i.event ?? null,
    title: i.title,
    body: i.body,
    detail: i.detail ?? null,
    confidenceBand: i.confidenceBand,
    dataPoints: i.dataPoints,
    coefficient: i.coefficient,
    effectSize: i.effectSize,
    effectUnit: i.effectUnit,
    evidence: i.evidence as Prisma.InputJsonValue,
    triggerKind: i.triggerKind,
    triggerMeetId: i.triggerMeetId,
  }));

  const result = await prisma.athleteInsight.createMany({ data: rows });
  return result.count;
}
