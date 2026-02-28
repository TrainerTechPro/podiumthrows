import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import {
  isR2Configured,
  uploadSingleFile,
  getPublicUrl,
  saveFileLocally,
  isAllowedImageType,
  MAX_IMAGE_SIZE_MB,
} from "@/lib/r2";

const MAX_FILE_SIZE = MAX_IMAGE_SIZE_MB * 1024 * 1024;

/**
 * POST /api/uploads/image
 * Generic image upload. Accepts multipart FormData with "file" field.
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

    if (!isAllowedImageType(file.type)) {
      return NextResponse.json(
        { success: false, error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large (max ${MAX_IMAGE_SIZE_MB}MB)` },
        { status: 400 }
      );
    }

    const ext = file.name?.split(".").pop()?.toLowerCase() ?? "jpg";
    const key = `images/${session.userId}/${randomUUID()}.${ext}`;

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
    console.error("[POST /api/uploads/image]", error);
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
  }
}
