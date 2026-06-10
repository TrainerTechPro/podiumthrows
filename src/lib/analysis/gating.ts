import prisma from "@/lib/prisma";

/**
 * Tier gating (PRD §8): Free 3 analyses/month + watermark on PDF;
 * Pro 50/month; Elite unlimited + calibrated-velocity metrics.
 *
 * Quota is org-level (the coach's roster shares the pool) and counted per
 * calendar month (UTC) over analysis_jobs, excluding FAILED — a failed run
 * never burns an athlete's quota.
 */

export const PLAN_QUOTAS: Record<string, number | null> = {
  FREE: 3,
  PRO: 50,
  ELITE: null, // unlimited
};

export interface AnalysisAllowance {
  allowed: boolean;
  plan: "FREE" | "PRO" | "ELITE";
  used: number;
  quota: number | null;
  remaining: number | null;
  watermark: boolean;
  /** Calibrated velocity/distance metrics are an Elite feature (PRD §8). */
  calibratedVelocity: boolean;
}

export function monthStartUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function checkAnalysisAllowance(
  athleteId: string,
  now: Date = new Date()
): Promise<AnalysisAllowance | null> {
  const athlete = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    select: { coachId: true, coach: { select: { plan: true } } },
  });
  if (!athlete) return null;

  const plan = (athlete.coach?.plan ?? "FREE") as AnalysisAllowance["plan"];
  // NOT `?? 3`: ELITE's quota IS null (unlimited) — nullish-coalescing it
  // away would cap Elite at the Free tier.
  const quota = plan in PLAN_QUOTAS ? PLAN_QUOTAS[plan] : 3;

  const used = await prisma.analysisJob.count({
    where: {
      athlete: { coachId: athlete.coachId },
      createdAt: { gte: monthStartUtc(now) },
      status: { not: "FAILED" },
    },
  });

  const remaining = quota === null ? null : Math.max(0, quota - used);
  return {
    allowed: quota === null || used < quota,
    plan,
    used,
    quota,
    remaining,
    watermark: plan === "FREE",
    calibratedVelocity: plan === "ELITE",
  };
}
