import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession } from "@/lib/data/coach";
import {
  isR2Configured,
  isAllowedVideoType,
  isAllowedVideoExtension,
  generateVideoKey,
  getPresignedUploadUrl,
  getPublicUrl,
  MAX_VIDEO_SIZE_MB,
} from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachSession();
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

    // Validate file type
    if (!isAllowedVideoType(contentType) || !isAllowedVideoExtension(fileName)) {
      return NextResponse.json(
        { error: "Only MP4, MOV, and WebM video files are allowed" },
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
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
