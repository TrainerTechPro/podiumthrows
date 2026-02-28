import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession } from "@/lib/data/coach";
import {
  isR2Configured,
  generateImageKey,
  getPresignedUploadUrl,
  getPublicUrl,
} from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachSession();
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
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
