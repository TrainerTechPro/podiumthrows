import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import {
  isR2Configured,
  isAllowedVideoType,
  generateVideoKey,
  getPresignedUploadUrl,
  getPublicUrl,
  MAX_VIDEO_SIZE_MB,
} from "@/lib/storage";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();
    const body = await req.json();

    const { fileName, contentType, fileSizeMb } = body as {
      fileName?: string;
      contentType?: string;
      fileSizeMb?: number;
    };

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: "fileName and contentType are required" },
        { status: 400 }
      );
    }

    // Validate file type — be lenient with MIME (some mobile browsers send odd types)
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const validExts = ["mp4", "mov", "webm", "m4v", "3gp"];
    if (!isAllowedVideoType(contentType) && !validExts.includes(ext)) {
      return NextResponse.json(
        { error: "Unsupported video format. Please use MP4, MOV, or WebM." },
        { status: 400 }
      );
    }

    // Validate file size
    if (fileSizeMb && fileSizeMb > MAX_VIDEO_SIZE_MB) {
      return NextResponse.json(
        { error: `File size must be under ${MAX_VIDEO_SIZE_MB}MB` },
        { status: 400 }
      );
    }

    const key = generateVideoKey(coach.id, fileName);

    if (isR2Configured()) {
      // R2 mode: return presigned URL for direct upload
      const { uploadUrl, publicUrl } = await getPresignedUploadUrl(
        key,
        contentType
      );

      return NextResponse.json({
        mode: "r2",
        uploadUrl,
        key,
        publicUrl,
      });
    } else {
      // Local mode: client will POST multipart to upload-local
      const publicUrl = getPublicUrl(key);

      return NextResponse.json({
        mode: "local",
        uploadUrl: "/api/coach/videos/upload-local",
        key,
        publicUrl,
      });
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("upload-url Error", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
