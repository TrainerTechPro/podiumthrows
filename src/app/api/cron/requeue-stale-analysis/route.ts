import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertCronAuth } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { transitionJob } from "@/lib/analysis/jobs";
import { enqueuePoseJob } from "@/lib/analysis/pose-client";
import { processPoseComplete } from "@/lib/analysis/process";

/**
 * Stale-job retry (decisions.md D4): jobs stuck QUEUED (trigger never fired /
 * service was down) are re-triggered; jobs stuck PROCESSING past the timeout
 * are walked back to QUEUED and re-triggered. Modal p95 is ≤ 90s, so 15
 * minutes of PROCESSING means the container died without webhooking.
 * Jobs stuck POSE_COMPLETE (webhook landed but the continuation died with the
 * function instance) re-run processPoseComplete — no GPU re-run needed.
 */
const PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;
const QUEUED_RETRY_AFTER_MS = 2 * 60 * 1000;
const MAX_BATCH = 10;

export async function POST(req: NextRequest) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  const now = Date.now();
  const stale = await prisma.analysisJob.findMany({
    where: {
      OR: [
        { status: "QUEUED", updatedAt: { lt: new Date(now - QUEUED_RETRY_AFTER_MS) } },
        { status: "PROCESSING", updatedAt: { lt: new Date(now - PROCESSING_TIMEOUT_MS) } },
        { status: "POSE_COMPLETE", updatedAt: { lt: new Date(now - QUEUED_RETRY_AFTER_MS) } },
      ],
    },
    orderBy: { updatedAt: "asc" },
    take: MAX_BATCH,
  });

  let retriggered = 0;
  for (const job of stale) {
    if (job.status === "POSE_COMPLETE") {
      const ok = await processPoseComplete(job.id)
        .then(() => true)
        .catch((err) => {
          logger.error("cron/requeue-stale-analysis: continuation threw", {
            metadata: { jobId: job.id },
            error: err instanceof Error ? err : new Error(String(err)),
          });
          return false;
        });
      if (ok) retriggered++;
      continue;
    }
    if (job.status === "PROCESSING") {
      const reset = await transitionJob(job.id, "QUEUED");
      if (!reset) continue;
    }
    const ok = await enqueuePoseJob(job).catch((err) => {
      logger.error("cron/requeue-stale-analysis: trigger threw", {
        metadata: { jobId: job.id },
        error: err instanceof Error ? err : new Error(String(err)),
      });
      return false;
    });
    if (ok) retriggered++;
  }

  return NextResponse.json({
    success: true,
    data: { scanned: stale.length, retriggered },
  });
}
