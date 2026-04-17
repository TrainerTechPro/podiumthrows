// src/lib/insights/persist.ts
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { notifyInsightsNew } from "./notify";
import type { RenderedInsight } from "./types";

type PersistItem = RenderedInsight & {
  triggerKind: "MEET_COMPLETE" | "ON_DEMAND" | "CRON";
  triggerMeetId: string | null;
};

export async function persistInsights(athleteId: string, items: PersistItem[]): Promise<number> {
  if (items.length === 0) return 0;

  // Look up which (category, metric) slots this athlete already has.
  // Used to decide which inserts are brand-new and deserve a notification.
  const priorSlots = await prisma.athleteInsight.findMany({
    where: { athleteId, metric: { in: items.map((i) => i.metric) } },
    select: { category: true, metric: true },
  });
  const seenSet = new Set(priorSlots.map((p) => `${p.category}:${p.metric}`));

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

  // Fire-and-forget: only for NEW slots. Failure never breaks persist.
  const newSlotItems = items.filter((i) => !seenSet.has(`${i.category}:${i.metric}`));
  if (newSlotItems.length > 0) {
    void Promise.resolve(
      notifyInsightsNew(
        athleteId,
        newSlotItems.map((i) => ({
          category: i.category,
          metric: i.metric,
          title: i.title,
          body: i.body,
        }))
      )
    ).catch((err) => {
      logger.error("insight notification dispatch failed", {
        context: "insights/persist",
        metadata: { athleteId },
        error: err,
      });
    });
  }

  return result.count;
}
