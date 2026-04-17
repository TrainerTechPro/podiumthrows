// src/lib/insights/notify.ts
import prisma from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import type { InsightCategory } from "./types";

type NewInsightInput = {
  category: InsightCategory;
  title: string;
  body: string;
};

/**
 * Fire `INSIGHT_NEW` notifications for first-time-slot insights.
 * One notification per recipient per batch (not per-insight). Never throws —
 * all errors are logged and swallowed so the caller's persist doesn't fail.
 */
export async function notifyInsightsNew(
  athleteId: string,
  newInsights: NewInsightInput[]
): Promise<void> {
  try {
    if (newInsights.length === 0) return;

    const athlete = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: {
        id: true,
        coachId: true,
        isSelfCoached: true,
        user: { select: { email: true } },
      },
    });
    if (!athlete) return;

    const title = newInsights.length === 1 ? "New insight" : `${newInsights.length} new insights`;
    const body =
      newInsights.length === 1 ? newInsights[0].title : `Including: ${newInsights[0].title}`;
    const categories = newInsights.map((i) => i.category);

    // Always notify the athlete
    await createNotification({
      type: "INSIGHT_NEW",
      title,
      body,
      athleteProfileId: athlete.id,
      metadata: {
        insightCount: newInsights.length,
        categories,
        href: "/athlete/insights",
      },
    });

    // Notify coach unless athlete is self-coached
    if (!athlete.isSelfCoached && athlete.coachId) {
      await createNotification({
        type: "INSIGHT_NEW",
        title: `${title} · ${athlete.user.email}`,
        body,
        coachId: athlete.coachId,
        metadata: {
          insightCount: newInsights.length,
          categories,
          href: `/coach/athletes/${athlete.id}/insights`,
        },
      });
    }
  } catch (err) {
    logger.error("notifyInsightsNew failed", { context: "insights/notify", error: err });
  }
}
