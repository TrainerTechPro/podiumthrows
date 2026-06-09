import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  canTransition,
  type JobStatus,
} from "@/lib/contracts";
import type { Prisma, AnalysisJobStatus } from "@prisma/client";

/**
 * Single chokepoint for analysis_jobs status changes. Every transition goes
 * through here so an illegal jump (QUEUED → COMPLETE, COMPLETE → anything)
 * can't be written from a race or a duplicate webhook.
 *
 * Returns the updated job, or null when the transition was rejected — callers
 * decide whether rejection is an error (route bug) or a no-op (duplicate
 * delivery).
 */
export async function transitionJob(
  jobId: string,
  to: JobStatus,
  patch: Omit<Prisma.AnalysisJobUpdateInput, "status"> = {}
) {
  return prisma.$transaction(async (tx) => {
    const job = await tx.analysisJob.findUnique({ where: { id: jobId } });
    if (!job) return null;
    if (!canTransition(job.status as JobStatus, to)) {
      logger.warn("analysis/jobs: rejected illegal transition", {
        metadata: { jobId, from: job.status, to },
      });
      return null;
    }
    return tx.analysisJob.update({
      where: { id: jobId, status: job.status },
      data: { ...patch, status: to as AnalysisJobStatus },
    });
  });
}
