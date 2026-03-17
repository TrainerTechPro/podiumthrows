import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { isR2Configured, uploadSingleFile, getPublicUrl, saveFileLocally } from "@/lib/r2";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const MAX_DURATION_SECONDS = 10.5; // 10s + small buffer

const ALLOWED_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/x-matroska",
  "video/x-m4v",
  "video/3gpp",
  "video/hevc",
];

// POST /api/throws/practice/video-upload
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Coach access required" }, { status: 403 });
    }

    // Client sends video duration in header so we can reject before reading body
    const durationHeader = request.headers.get("x-video-duration");
    if (durationHeader) {
      const duration = parseFloat(durationHeader);
      if (!isNaN(duration) && duration > MAX_DURATION_SECONDS) {
        return NextResponse.json(
          { success: false, error: `Video must be ${MAX_DURATION_SECONDS}s or less (got ${duration.toFixed(1)}s)` },
          { status: 400 }
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get("video") as File | null;
    const sessionId = formData.get("sessionId") as string | null;
    const athleteId = formData.get("athleteId") as string | null;
    const eventRaw = formData.get("event") as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No video file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "File too large (max 200MB)" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
    const key = `practice-attempts/${sessionId ?? "misc"}/${randomUUID()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let url: string;
    if (isR2Configured()) {
      await uploadSingleFile(key, buffer, file.type);
      url = getPublicUrl(key);
    } else {
      // Dev fallback — save to public/uploads/
      url = await saveFileLocally(key, buffer);
    }

    // Also create a VideoUpload record so practice videos appear in the video library
    try {
      const coach = await prisma.coachProfile.findUnique({
        where: { userId: currentUser.userId },
        select: { id: true },
      });
      if (coach) {
        const validEvents = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];
        await prisma.videoUpload.create({
          data: {
            coachId: coach.id,
            athleteId: athleteId || undefined,
            url,
            storageKey: key,
            title: `Practice Attempt${sessionId ? ` — Session` : ""}`,
            event: validEvents.includes(eventRaw ?? "") ? (eventRaw as never) : undefined,
            category: "training",
            status: "ready",
            fileSizeMb: file.size / (1024 * 1024),
            durationSec: durationHeader ? parseFloat(durationHeader) : undefined,
          },
        });
      }
    } catch (err) {
      // Non-fatal — video is uploaded, just not indexed in library
      logger.error("Failed to create VideoUpload record for practice attempt", { context: "throws/practice/video-upload", error: err });
    }

    return NextResponse.json({ success: true, url });
  } catch (error) {
    logger.error("POST /api/throws/practice/video-upload error", { context: "throws/practice/video-upload", error: error });
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
  }
}
