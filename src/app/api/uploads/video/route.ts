import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  isR2Configured,
  uploadSingleFile,
  getPublicUrl,
  saveFileLocally,
  isAllowedVideoType,
  MAX_VIDEO_SIZE_MB,
} from "@/lib/r2";

export const maxDuration = 120; // Allow up to 2 minutes for large uploads

const MAX_FILE_SIZE = MAX_VIDEO_SIZE_MB * 1024 * 1024;

const BROAD_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/x-matroska",
  "video/x-m4v",
  "video/3gpp",
  "video/hevc",
];

/**
 * POST /api/uploads/video
 * Generic video upload. Accepts multipart FormData with "file" field.
 * Returns { success: true, url: string }.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const ext = file.name?.split(".").pop()?.toLowerCase() ?? "mp4";
    const mimeOk = isAllowedVideoType(file.type) || BROAD_VIDEO_TYPES.includes(file.type);
    const extOk = ["mp4", "mov", "webm", "avi", "mkv", "m4v", "3gp"].includes(ext);

    if (!mimeOk && !extOk) {
      return NextResponse.json(
        { success: false, error: "Unsupported video format" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large (max ${MAX_VIDEO_SIZE_MB}MB)` },
        { status: 400 }
      );
    }

    const key = `uploads/videos/${session.userId}/${randomUUID()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (isR2Configured()) {
      await uploadSingleFile(key, buffer, file.type);
      const url = getPublicUrl(key);
      return NextResponse.json({ success: true, url });
    } else {
      const localUrl = await saveFileLocally(key, buffer);
      return NextResponse.json({ success: true, url: localUrl });
    }
  } catch (error) {
    logger.error("POST /api/uploads/video", { context: "api", error });
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
  }
}
