import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { parseBody, CoachVideoTranscodeCompleteSchema } from "@/lib/api-schemas";

/* ─── POST — Mark transcode as complete ─────────────────────────────────────── *
 *
 * Called after FFmpeg has finished processing and the transcoded file
 * has been uploaded to R2. Updates the VideoUpload record with the
 * transcoded URL and metadata.
 *
 * Body:
 *   {
 *     transcodedKey: string;   // R2 key of the transcoded file
 *     transcodedUrl: string;   // Public URL of the transcoded file
 *     fps?: number;            // Detected FPS (default 60)
 *     gopInterval?: number;    // GOP size used (default 15)
 *     success: boolean;        // Whether transcode succeeded
 *     error?: string;          // Error message if failed
 *   }
 * ─────────────────────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    // Verify ownership
    const video = await prisma.videoUpload.findFirst({
      where: { id: id, coachId: coach.id },
      select: { id: true, transcodeStatus: true },
    });

    if (!video) {
      return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
    }

    if (video.transcodeStatus !== "processing") {
      return NextResponse.json(
        { success: false, error: "Video is not currently being transcoded" },
        { status: 409 }
      );
    }

    const parsed = await parseBody(req, CoachVideoTranscodeCompleteSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { transcodedKey, transcodedUrl, fps, gopInterval, success, error } = parsed;

    if (!success) {
      // Transcode failed — reset status
      await prisma.videoUpload.update({
        where: { id: id },
        data: {
          transcodeStatus: "failed",
        },
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            videoId: id,
            transcodeStatus: "failed" as const,
            error: error ?? "Transcode failed",
          },
        },
        { status: 200 }
      );
    }

    if (!transcodedUrl) {
      return NextResponse.json(
        { success: false, error: "transcodedUrl is required when success=true" },
        { status: 400 }
      );
    }

    // Mark as ready
    await prisma.videoUpload.update({
      where: { id: id },
      data: {
        transcodeStatus: "ready",
        transcodedUrl,
        transcodedKey: transcodedKey ?? null,
        fps: fps ?? 60,
        gopInterval: gopInterval ?? 15,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        videoId: id,
        transcodeStatus: "ready" as const,
        transcodedUrl,
        gopInterval: gopInterval ?? 15,
        fps: fps ?? 60,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("videos/[id]/transcode/complete POST Error", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
