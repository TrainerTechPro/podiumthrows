import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { requireCoachApi } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import {
  isR2Configured,
  uploadSingleFile,
  getPublicUrl,
  saveFileLocally,
} from "@/lib/r2";

export const maxDuration = 120;

/* ── POST — upload a video for analysis ── */
export async function POST(request: NextRequest) {
  try {
    const { coach } = await requireCoachApi();

    const formData = await request.formData();
    const videoBlob = formData.get("video") as File | null;
    const athleteId = formData.get("athleteId") as string | null;
    const event = formData.get("event") as string | null;
    const title = formData.get("title") as string | null;
    const description = (formData.get("description") as string | null)?.trim() || null;
    const thumbnailBlob = formData.get("thumbnail") as File | null;

    // Validate required fields
    if (!videoBlob || !athleteId || !event || !title) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: video, athleteId, event, title" },
        { status: 400 }
      );
    }

    // Validate event type
    if (!["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"].includes(event)) {
      return NextResponse.json({ success: false, error: "Invalid event type" }, { status: 400 });
    }

    // Validate file type
    const ext = videoBlob.name?.split(".").pop()?.toLowerCase() || "mp4";
    const validExts = ["mp4", "mov", "webm", "m4v"];
    if (!validExts.includes(ext)) {
      return NextResponse.json(
        { success: false, error: "Unsupported video format. Use MP4, MOV, or WebM." },
        { status: 400 }
      );
    }

    // Validate file size (200MB max)
    if (videoBlob.size > 200 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "File too large (max 200MB)" }, { status: 400 });
    }

    // Verify athlete belongs to coach
    const athlete = await prisma.athleteProfile.findFirst({
      where: { id: athleteId, coachId: coach.id },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    // Upload video
    const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());
    const fileKey = `video-analysis/${coach.id}/${randomUUID()}.${ext}`;
    const mimeType = videoBlob.type || "video/mp4";

    let videoUrl: string;
    if (isR2Configured()) {
      await uploadSingleFile(fileKey, videoBuffer, mimeType);
      videoUrl = getPublicUrl(fileKey);
    } else {
      videoUrl = await saveFileLocally(fileKey, videoBuffer);
    }

    // Upload thumbnail if provided
    let thumbnailUrl: string | null = null;
    if (thumbnailBlob) {
      const thumbBuffer = Buffer.from(await thumbnailBlob.arrayBuffer());
      const thumbKey = `video-analysis/${coach.id}/thumb_${randomUUID()}.jpg`;
      if (isR2Configured()) {
        await uploadSingleFile(thumbKey, thumbBuffer, "image/jpeg");
        thumbnailUrl = getPublicUrl(thumbKey);
      } else {
        thumbnailUrl = await saveFileLocally(thumbKey, thumbBuffer);
      }
    }

    // Create database record
    const analysis = await prisma.videoAnalysis.create({
      data: {
        athleteId,
        coachId: coach.id,
        title: title.trim(),
        description,
        event,
        videoUrl,
        thumbnailUrl,
        status: "UPLOADED",
      },
      include: {
        athlete: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: analysis }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.name === "AuthError") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("POST /api/video-analysis/upload", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: `Upload failed: ${message}` }, { status: 500 });
  }
}
