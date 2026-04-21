import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import type { AthleteInsight } from "@prisma/client";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { toWire } from "@/lib/insights/serialize";
import { getInsightProgress } from "@/lib/insights/progress";
import { AthleteInsightsClient } from "./_insights-client";

export default async function AthleteInsightsPage() {
  const session = await getSession();
  if (!session) return notFound();

  const profile = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!profile) return notFound();

  const [rawRows, progress] = await Promise.all([
    prisma.$queryRaw<AthleteInsight[]>(Prisma.sql`
      SELECT DISTINCT ON ("athleteId", "category", "metric") *
      FROM "AthleteInsight"
      WHERE "athleteId" = ${profile.id}
        AND "dismissedAt" IS NULL
      ORDER BY "athleteId", "category", "metric", "computedAt" DESC
      LIMIT 50
    `),
    getInsightProgress(profile.id),
  ]);

  const insights = rawRows.map((row) => toWire(row, "ATHLETE"));

  return (
    <AthleteInsightsClient athleteId={profile.id} initialInsights={insights} progress={progress} />
  );
}
