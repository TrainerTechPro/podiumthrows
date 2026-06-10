import { logger } from "@/lib/logger";
import { getPresignedDownloadUrl, getPresignedUploadUrl } from "@/lib/r2";

/**
 * Fire the Modal pose service for a job (D4: the analysis_jobs row is the
 * queue; this is the direct trigger; the requeue cron is the retry).
 *
 * R2 credentials never leave Vercel: Modal gets a presigned GET for the clip
 * and a presigned PUT for the pose JSON.
 *
 * Returns true when the trigger was accepted. False (with a warn log) when the
 * service env is not configured — the job stays QUEUED and the requeue cron
 * will retry once MODAL_POSE_URL is set (TODO(user): deploy, see
 * services/pose/DEPLOY.md).
 */
export function poseRawPath(jobId: string): string {
  return `analysis/${jobId}/pose-raw.json`;
}

export async function enqueuePoseJob(job: {
  id: string;
  clipPath: string;
}): Promise<boolean> {
  const url = process.env.MODAL_POSE_URL;
  const token = process.env.MODAL_POSE_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (!url || !token || !appUrl) {
    logger.warn("analysis/pose-client: pose service env missing; job stays QUEUED", {
      metadata: {
        jobId: job.id,
        missing: [
          !url && "MODAL_POSE_URL",
          !token && "MODAL_POSE_TOKEN",
          !appUrl && "NEXT_PUBLIC_APP_URL",
        ].filter(Boolean),
      },
    });
    return false;
  }

  const rawPath = poseRawPath(job.id);
  const [clipUrl, upload] = await Promise.all([
    getPresignedDownloadUrl(job.clipPath, 3600),
    getPresignedUploadUrl(rawPath, "application/json"),
  ]);
  const poseUploadUrl = upload.uploadUrl;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jobId: job.id,
      clipUrl,
      poseUploadUrl,
      rawPath,
      webhookUrl: `${appUrl.replace(/\/$/, "")}/api/analysis/webhooks/pose`,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error("analysis/pose-client: Modal trigger failed", {
      metadata: { jobId: job.id, status: res.status, body: text.slice(0, 300) },
    });
    return false;
  }
  return true;
}
