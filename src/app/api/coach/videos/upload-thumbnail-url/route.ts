import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import {
  isR2Configured,
  generateImageKey,
  getPresignedUploadUrl,
  getPublicUrl,
} from "@/lib/storage";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();
    const body = await req.json();

    const { fileName, contentType } = body as {
      fileName?: string;
      contentType?: string;
    };

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: "fileName and contentType are required" },
        { status: 400 }
      );
    }

    if (contentType !== "image/jpeg") {
      return NextResponse.json(
        { error: "Only image/jpeg thumbnails are supported" },
        { status: 400 }
      );
    }

    const key = generateImageKey(coach.id, fileName);

    if (isR2Configured()) {
      const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType);
      return NextResponse.json({ mode: "r2", uploadUrl, key, publicUrl });
    } else {
      const publicUrl = getPublicUrl(key);
      return NextResponse.json({
        mode: "local",
        uploadUrl: "/api/coach/videos/upload-thumbnail-local",
        key,
        publicUrl,
      });
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("upload-thumbnail-url Error", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
