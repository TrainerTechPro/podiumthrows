// src/lib/insights/persist.ts
import { Prisma } from "@prisma/client";
import { waitUntil } from "@vercel/functions";
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

  // Dedupe: one row per (athleteId, category, metric). Delete prior rows for
  // the slots we're about to write, then insert fresh. Transactional so
  // readers never see a partial or empty state for a slot mid-write.
  const slots = items.map((i) => ({ category: i.category, metric: i.metric }));
  const result = await prisma.$transaction(async (tx) => {
    await tx.athleteInsight.deleteMany({
      where: { athleteId, OR: slots },
    });
    return tx.athleteInsight.createMany({ data: rows });
  });

  // Only fire notifications for brand-new (category, metric) slots.
  // Wrap in waitUntil so the dispatch survives the response returning —
  // Next.js 14.2 on Vercel kills un-waited promises after the handler resolves.
  const newSlotItems = items.filter((i) => !seenSet.has(`${i.category}:${i.metric}`));
  if (newSlotItems.length > 0) {
    waitUntil(
      Promise.resolve(
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
      })
    );
  }

  return result.count;
}
