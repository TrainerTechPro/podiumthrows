import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import prisma from "@/lib/prisma";

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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachApi();

    // Verify ownership
    const video = await prisma.videoUpload.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true, transcodeStatus: true },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.transcodeStatus !== "processing") {
      return NextResponse.json(
        { error: "Video is not currently being transcoded" },
        { status: 409 }
      );
    }

    const body = await req.json();
    const { transcodedKey, transcodedUrl, fps, gopInterval, success, error } =
      body as {
        transcodedKey?: string;
        transcodedUrl?: string;
        fps?: number;
        gopInterval?: number;
        success?: boolean;
        error?: string;
      };

    if (!success) {
      // Transcode failed — reset status
      await prisma.videoUpload.update({
        where: { id: params.id },
        data: {
          transcodeStatus: "failed",
        },
      });

      return NextResponse.json(
        {
          videoId: params.id,
          transcodeStatus: "failed",
          error: error ?? "Transcode failed",
        },
        { status: 200 }
      );
    }

    if (!transcodedUrl) {
      return NextResponse.json(
        { error: "transcodedUrl is required when success=true" },
        { status: 400 }
      );
    }

    // Mark as ready
    await prisma.videoUpload.update({
      where: { id: params.id },
      data: {
        transcodeStatus: "ready",
        transcodedUrl,
        transcodedKey: transcodedKey ?? null,
        fps: fps ?? 60,
        gopInterval: gopInterval ?? 15,
      },
    });

    return NextResponse.json({
      videoId: params.id,
      transcodeStatus: "ready",
      transcodedUrl,
      gopInterval: gopInterval ?? 15,
      fps: fps ?? 60,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[videos/[id]/transcode/complete] POST Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
