import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import {
  isR2Configured,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
} from "@/lib/r2";

/* ─── FFmpeg Transcode Spec ───────────────────────────────────────────────────
 *
 * iPhone videos (.mov) use sparse keyframes (GOP 60-250), causing massive jitter
 * when scrubbing backward. The browser can only seek to I-frames, so large GOP
 * intervals mean imprecise seeking.
 *
 * Solution: Re-encode to H.264 baseline with GOP 15 for frame-accurate scrubbing.
 *
 * Command:
 *   ffmpeg -i input.mov \
 *     -c:v libx264 -profile:v baseline -level 3.1 \
 *     -g 15 -keyint_min 15 \
 *     -c:a aac -b:a 128k \
 *     -movflags +faststart \
 *     -pix_fmt yuv420p \
 *     output.mp4
 *
 * Flags:
 *   -g 15             → GOP size of 15 frames (keyframe every 0.25s at 60fps)
 *   -keyint_min 15    → Prevent encoder from inserting extra keyframes
 *   -profile:v baseline → Maximum device compatibility
 *   -movflags +faststart → Move moov atom to start for streaming
 *   -pix_fmt yuv420p  → Universal pixel format
 *
 * This route initiates the transcode by:
 *   1. Returning a presigned download URL for the source video
 *   2. Returning a presigned upload URL for the transcoded output
 *   3. Returning the exact FFmpeg command to execute
 *   4. Setting transcodeStatus to "processing"
 *
 * The actual FFmpeg execution happens externally (Cloudflare Worker, serverless
 * function, or queue). When complete, POST to /transcode/complete with the result.
 * ─────────────────────────────────────────────────────────────────────────────── */

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachSession();

    // Verify ownership and get source video
    const video = await prisma.videoUpload.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: {
        id: true,
        url: true,
        storageKey: true,
        transcodeStatus: true,
      },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Already transcoding or done
    if (video.transcodeStatus === "processing") {
      return NextResponse.json(
        { error: "Transcode already in progress" },
        { status: 409 }
      );
    }

    if (video.transcodeStatus === "ready") {
      return NextResponse.json(
        { error: "Video already transcoded" },
        { status: 409 }
      );
    }

    if (!isR2Configured() || !video.storageKey) {
      return NextResponse.json(
        { error: "R2 not configured or no storage key available" },
        { status: 400 }
      );
    }

    // Generate presigned URLs
    const sourceDownloadUrl = await getPresignedDownloadUrl(video.storageKey);

    // Output key: same path with _transcoded suffix
    const ext = video.storageKey.split(".").pop() ?? "mp4";
    const basePath = video.storageKey.replace(`.${ext}`, "");
    const outputKey = `${basePath}_transcoded.mp4`;

    const { uploadUrl: outputUploadUrl, publicUrl: transcodedPublicUrl } =
      await getPresignedUploadUrl(outputKey, "video/mp4");

    // Mark as processing
    await prisma.videoUpload.update({
      where: { id: params.id },
      data: { transcodeStatus: "processing" },
    });

    // FFmpeg command spec
    const ffmpegCommand = [
      "ffmpeg",
      "-i", "input.mov",
      "-c:v", "libx264",
      "-profile:v", "baseline",
      "-level", "3.1",
      "-g", "15",
      "-keyint_min", "15",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-pix_fmt", "yuv420p",
      "output.mp4",
    ];

    return NextResponse.json({
      videoId: params.id,
      sourceDownloadUrl,
      outputUploadUrl,
      outputKey,
      transcodedPublicUrl,
      ffmpegCommand: ffmpegCommand.join(" "),
      ffmpegArgs: ffmpegCommand,
      gopSize: 15,
      completeCallbackUrl: `/api/coach/videos/${params.id}/transcode/complete`,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/* ─── GET — Check transcode status ─────────────────────────────────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachSession();

    const video = await prisma.videoUpload.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: {
        id: true,
        transcodeStatus: true,
        transcodedUrl: true,
        gopInterval: true,
        fps: true,
      },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json({
      videoId: video.id,
      transcodeStatus: video.transcodeStatus,
      transcodedUrl: video.transcodedUrl,
      gopInterval: video.gopInterval,
      fps: video.fps,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
