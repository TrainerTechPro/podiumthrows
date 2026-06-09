import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { transitionJob } from "@/lib/analysis/jobs";
import { PoseWebhookPayloadSchema } from "@/lib/contracts";

/**
 * Modal pose-service callback (PRD F3). Auth: hex HMAC-SHA256 of the raw body
 * with POSE_WEBHOOK_SECRET in X-Pose-Signature (services/pose/webhook.py is
 * the signing side). CSRF is skipped for this path in middleware because this
 * header IS the auth.
 *
 * Idempotent: a duplicate delivery (job already at/past the target status)
 * returns { received: true, duplicate: true } and writes nothing — same
 * pattern as the Stripe webhook.
 */

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.POSE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(header, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-pose-signature"))) {
    return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
  }

  let payload;
  try {
    payload = PoseWebhookPayloadSchema.parse(JSON.parse(rawBody));
  } catch (err) {
    logger.error("analysis/webhooks/pose: invalid payload", {
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const job = await prisma.analysisJob.findUnique({
    where: { id: payload.jobId },
    include: { poseArtifact: { select: { id: true } } },
  });
  if (!job) {
    return NextResponse.json({ success: false, error: "Unknown job" }, { status: 404 });
  }

  if (payload.status === "pose_complete") {
    // Duplicate delivery: artifact already recorded or job already advanced.
    if (job.poseArtifact || !["QUEUED", "PROCESSING"].includes(job.status)) {
      return NextResponse.json({ success: true, data: { received: true, duplicate: true } });
    }
    if (!payload.rawPath || !payload.modelId || !payload.modelVersion) {
      return NextResponse.json(
        { success: false, error: "pose_complete requires rawPath, modelId, modelVersion" },
        { status: 400 }
      );
    }
    // Tolerate a missed "accepted" callback: walk QUEUED → PROCESSING first.
    if (job.status === "QUEUED") {
      await transitionJob(job.id, "PROCESSING");
    }
    const updated = await transitionJob(job.id, "POSE_COMPLETE", {
      fpsTrue: payload.fpsTrue ?? undefined,
      timings: {
        ...(typeof job.timings === "object" && job.timings !== null ? job.timings : {}),
        pose: payload.timings ?? null,
        poseFinishedAt: new Date().toISOString(),
      },
    });
    if (!updated) {
      return NextResponse.json({ success: true, data: { received: true, duplicate: true } });
    }
    await prisma.poseArtifact.create({
      data: {
        jobId: job.id,
        rawPath: payload.rawPath,
        modelId: payload.modelId,
        modelVersion: payload.modelVersion,
      },
    });
    logger.info("analysis/webhooks/pose: pose_complete recorded", {
      metadata: { jobId: job.id, modelId: payload.modelId },
    });
    return NextResponse.json({ success: true, data: { received: true } });
  }

  // status === "failed"
  if (["FAILED", "COMPLETE", "LOW_CONFIDENCE"].includes(job.status)) {
    return NextResponse.json({ success: true, data: { received: true, duplicate: true } });
  }
  if (job.status === "QUEUED") {
    await transitionJob(job.id, "PROCESSING");
  }
  const failed = await transitionJob(job.id, "FAILED", {
    error: payload.error ?? { code: "UNKNOWN", message: "Pose service reported failure" },
  });
  if (!failed) {
    return NextResponse.json({ success: true, data: { received: true, duplicate: true } });
  }
  logger.warn("analysis/webhooks/pose: job failed", {
    metadata: { jobId: job.id, code: payload.error?.code },
  });
  return NextResponse.json({ success: true, data: { received: true } });
}
