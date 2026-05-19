import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { getTeamFiles, createTeamFile } from "@/lib/data/team-hub";
import { logger } from "@/lib/logger";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/msword",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

/* ─── GET — list all team files for the authenticated coach ──────────────── */

export async function GET() {
  try {
    const { coach } = await requireCoachApi();
    const files = await getTeamFiles(coach.id);
    return NextResponse.json({ success: true, data: files });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/coach/team-files", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t fetch files" },
      { status: 500 },
    );
  }
}

/* ─── POST — register a file after successful R2 upload ──────────────────── */

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      fileKey?: string;
      fileUrl?: string;
      fileSize?: number;
      mimeType?: string;
      category?: string;
    };

    if (
      !body.name ||
      !body.fileKey ||
      !body.fileUrl ||
      !body.mimeType ||
      typeof body.fileSize !== "number"
    ) {
      return NextResponse.json(
        { success: false, error: "name, fileKey, fileUrl, fileSize, mimeType required" },
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

    const result = await createTeamFile(coach.id, {
      name: body.name,
      fileKey: body.fileKey,
      fileUrl: body.fileUrl,
      fileSize: body.fileSize,
      mimeType: body.mimeType,
      category: body.category ?? null,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("POST /api/coach/team-files", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t register file" },
      { status: 500 },
    );
  }
}
