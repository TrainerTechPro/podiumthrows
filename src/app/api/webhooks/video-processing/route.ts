import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/* ─── POST — Video Processing Webhook ─────────────────────────────────────── *
 *
 * Called by external video processing services (Inngest, Trigger.dev,
 * AWS MediaConvert, Cloudflare Worker, etc.) when processing completes.
 *
 * Authentication: Bearer token matching VIDEO_PROCESSING_WEBHOOK_SECRET.
 * Falls back to x-webhook-secret header for simpler integrations.
 *
 * Body:
 *   {
 *     videoId: string;           // VideoUpload.id
 *     status: "ready" | "failed";
 *     thumbnailUrl?: string;     // Generated thumbnail URL
 *     transcodedUrl?: string;    // Transcoded video URL (GOP-15)
 *     transcodedKey?: string;    // R2 key for transcoded file
 *     fps?: number;              // Detected FPS
 *     gopInterval?: number;      // GOP size used
 *     durationSec?: number;      // Detected duration
 *     error?: string;            // Error message if failed
 *   }
 * ─────────────────────────────────────────────────────────────────────────── */

const WEBHOOK_SECRET = process.env.VIDEO_PROCESSING_WEBHOOK_SECRET;

function verifyWebhookAuth(req: NextRequest): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("[video-processing webhook] VIDEO_PROCESSING_WEBHOOK_SECRET not set — rejecting all requests");
    return false;
  }

  // Check Authorization: Bearer <token>
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7) === WEBHOOK_SECRET;
  }

  // Fallback: x-webhook-secret header
  const headerSecret = req.headers.get("x-webhook-secret");
  if (headerSecret) {
    return headerSecret === WEBHOOK_SECRET;
  }

  return false;
}

type WebhookPayload = {
  videoId?: string;
  status?: "ready" | "failed";
  thumbnailUrl?: string;
  transcodedUrl?: string;
  transcodedKey?: string;
  fps?: number;
  gopInterval?: number;
  durationSec?: number;
  error?: string;
};

export async function POST(req: NextRequest) {
  // Authenticate
  if (!verifyWebhookAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as WebhookPayload;
    const { videoId, status, thumbnailUrl, transcodedUrl, transcodedKey, fps, gopInterval, durationSec, error } = body;

    if (!videoId) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    if (!status || !["ready", "failed"].includes(status)) {
      return NextResponse.json(
        { error: 'status must be "ready" or "failed"' },
        { status: 400 }
      );
    }

    // Find the video (no coach auth — this is a service-to-service call)
    const video = await prisma.videoUpload.findUnique({
      where: { id: videoId },
      select: { id: true, status: true },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Only update videos that are currently processing
    if (video.status !== "processing") {
      return NextResponse.json(
        { error: `Video status is "${video.status}", expected "processing"` },
        { status: 409 }
      );
    }

    if (status === "failed") {
      await prisma.videoUpload.update({
        where: { id: videoId },
        data: { status: "failed" },
      });

      return NextResponse.json({
        videoId,
        status: "failed",
        error: error ?? "Processing failed",
      });
    }

    // status === "ready"
    const updateData: Record<string, unknown> = { status: "ready" };

    if (thumbnailUrl) updateData.thumbnailUrl = thumbnailUrl;
    if (transcodedUrl) {
      updateData.transcodedUrl = transcodedUrl;
      updateData.transcodeStatus = "ready";
    }
    if (transcodedKey) updateData.transcodedKey = transcodedKey;
    if (fps) updateData.fps = fps;
    if (gopInterval) updateData.gopInterval = gopInterval;
    if (durationSec) updateData.durationSec = durationSec;

    await prisma.videoUpload.update({
      where: { id: videoId },
      data: updateData,
    });

    return NextResponse.json({
      videoId,
      status: "ready",
    });
  } catch (err) {
    logger.error("video-processing webhook Error", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
