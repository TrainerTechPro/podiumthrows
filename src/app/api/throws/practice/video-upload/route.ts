import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { isR2Configured, uploadSingleFile, getPublicUrl, saveFileLocally } from "@/lib/r2";
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

    if (isR2Configured()) {
      await uploadSingleFile(key, buffer, file.type);
      const url = getPublicUrl(key);
      return NextResponse.json({ success: true, url });
    } else {
      // Dev fallback — save to public/uploads/
      const localUrl = await saveFileLocally(key, buffer);
      return NextResponse.json({ success: true, url: localUrl });
    }
  } catch (error) {
    logger.error("POST /api/throws/practice/video-upload error", { context: "throws/practice/video-upload", error: error });
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
  }
}
