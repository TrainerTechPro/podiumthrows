import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { isR2Configured, getPresignedUploadUrl } from "@/lib/r2";
import { logger } from "@/lib/logger";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.ms-excel", // xls
  "application/msword", // doc
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 100);
}

export async function POST(req: NextRequest) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json(
        { success: false, error: "File uploads not configured" },
        { status: 503 },
      );
    }

    const { coach } = await requireCoachApi();

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      mimeType?: string;
      fileSize?: number;
    };

    if (!body.name || !body.mimeType || typeof body.fileSize !== "number") {
      return NextResponse.json(
        { success: false, error: "name, mimeType, and fileSize are required" },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(body.mimeType)) {
      return NextResponse.json(
        { success: false, error: "File type not allowed" },
        { status: 400 },
      );
    }

    if (body.fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 400 },
      );
    }

    const timestamp = Date.now();
    const randomId = randomBytes(6).toString("hex");
    const sanitized = sanitizeFilename(body.name);
    const fileKey = `team-files/${coach.id}/${timestamp}-${randomId}-${sanitized}`;

    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(
      fileKey,
      body.mimeType,
    );

    return NextResponse.json({
      success: true,
      data: { uploadUrl, publicUrl, fileKey },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("POST /api/coach/team-files/upload-url", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Couldn’t create upload URL" },
      { status: 500 },
    );
  }
}
