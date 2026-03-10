import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  isR2Configured,
  getPresignedUploadUrl,
  getPublicUrl,
  uploadSingleFile,
  saveFileLocally,
} from "@/lib/r2";

/* ── GET — list codex entries for the current user ── */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get("sort") || "thrownAt";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";
    const event = searchParams.get("event");
    const implement = searchParams.get("implement");

    const where: Record<string, unknown> = { userId: user.userId };
    if (event) where.event = event;
    if (implement) where.implement = implement;

    const orderBy =
      sortBy === "implement"
        ? { implement: order as "asc" | "desc" }
        : sortBy === "distance"
          ? { distance: order as "asc" | "desc" }
          : { thrownAt: order as "asc" | "desc" };

    const entries = await prisma.codexEntry.findMany({
      where,
      orderBy,
      take: 200,
    });

    return NextResponse.json({ ok: true, data: entries });
  } catch (err) {
    console.error("[GET /api/codex]", err);
    return NextResponse.json({ error: "Failed to fetch codex entries" }, { status: 500 });
  }
}

/* ── POST — create a codex entry ──
   Two modes:
   1. step=upload-url → returns presigned URL for direct R2 upload (or local upload endpoint)
   2. step=confirm    → saves the metadata after video is uploaded
   3. step=local      → accepts FormData with video file for local dev (no R2)
── */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";

    // ── Local upload (FormData with video file) ──
    if (contentType.includes("multipart/form-data")) {
      return handleLocalUpload(request, user.userId);
    }

    // ── JSON requests (upload-url or confirm) ──
    const body = await request.json();
    const step = body.step as string;

    if (step === "upload-url") {
      return handleUploadUrl(body, user.userId);
    }

    if (step === "confirm") {
      return handleConfirm(body, user.userId);
    }

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/codex]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}

/* ── Step 1: Generate presigned upload URL ── */
async function handleUploadUrl(
  body: Record<string, unknown>,
  userId: string
) {
  const fileName = body.fileName as string | undefined;
  const fileContentType = body.contentType as string | undefined;
  const fileSizeMb = body.fileSizeMb as number | undefined;

  if (!fileName) {
    return NextResponse.json({ error: "fileName is required" }, { status: 400 });
  }

  // Lenient format check — accept any video extension
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const validExts = ["mp4", "mov", "webm", "m4v", "3gp", "avi", "mkv", "hevc"];
  const validMimes = [
    "video/mp4", "video/quicktime", "video/webm", "video/x-m4v",
    "video/3gpp", "video/hevc", "video/x-msvideo", "video/x-matroska",
  ];

  const mimeOk = fileContentType && validMimes.includes(fileContentType);
  const extOk = validExts.includes(ext);

  if (!mimeOk && !extOk) {
    return NextResponse.json(
      { error: "Unsupported video format. Use MP4, MOV, or WebM." },
      { status: 400 }
    );
  }

  if (fileSizeMb && fileSizeMb > 500) {
    return NextResponse.json({ error: "File too large (max 500MB)" }, { status: 400 });
  }

  const fileKey = `codex/${userId}/${randomUUID()}.${ext || "mp4"}`;

  if (isR2Configured()) {
    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(
      fileKey,
      fileContentType || "video/mp4"
    );
    return NextResponse.json({ mode: "r2", uploadUrl, key: fileKey, publicUrl });
  } else {
    const publicUrl = getPublicUrl(fileKey);
    return NextResponse.json({ mode: "local", key: fileKey, publicUrl });
  }
}

/* ── Step 2: Confirm upload and save metadata ── */
async function handleConfirm(
  body: Record<string, unknown>,
  userId: string
) {
  const event = body.event as string | undefined;
  const implement = body.implement as string | undefined;
  const distanceStr = body.distance as string | number | undefined;
  const videoUrl = body.videoUrl as string | undefined;
  const fileSize = (body.fileSize as number) || 0;
  const notes = (body.notes as string)?.trim() || null;
  const thrownAtStr = body.thrownAt as string | undefined;

  if (!event || !implement || !distanceStr || !videoUrl) {
    return NextResponse.json(
      { error: "Missing required fields: event, implement, distance, videoUrl" },
      { status: 400 }
    );
  }

  const distance = typeof distanceStr === "number" ? distanceStr : parseFloat(distanceStr);
  if (isNaN(distance) || distance <= 0) {
    return NextResponse.json({ error: "Distance must be a positive number" }, { status: 400 });
  }

  if (!["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"].includes(event)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  const thrownAt = thrownAtStr ? new Date(thrownAtStr) : new Date();

  const entry = await prisma.codexEntry.create({
    data: {
      userId,
      event: event as "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN",
      implement,
      distance,
      videoUrl,
      fileSize,
      notes,
      thrownAt,
    },
  });

  return NextResponse.json({ ok: true, data: entry }, { status: 201 });
}

/* ── Local dev: direct upload via FormData ── */
export const maxDuration = 120;

async function handleLocalUpload(request: NextRequest, userId: string) {
  const formData = await request.formData();
  const videoBlob = formData.get("video") as File | null;
  const event = formData.get("event") as string | null;
  const implement = formData.get("implement") as string | null;
  const distanceStr = formData.get("distance") as string | null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const thrownAtStr = formData.get("thrownAt") as string | null;

  if (!videoBlob || !event || !implement || !distanceStr) {
    return NextResponse.json(
      { error: "Missing required fields: video, event, implement, distance" },
      { status: 400 }
    );
  }

  const distance = parseFloat(distanceStr);
  if (isNaN(distance) || distance <= 0) {
    return NextResponse.json({ error: "Distance must be a positive number" }, { status: 400 });
  }

  if (!["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"].includes(event)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  const ext = videoBlob.name?.split(".").pop()?.toLowerCase() || "mp4";
  const mimeType = videoBlob.type || "video/mp4";
  const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());
  const fileKey = `codex/${userId}/${randomUUID()}.${ext}`;

  const videoUrl = isR2Configured()
    ? (await uploadSingleFile(fileKey, videoBuffer, mimeType), getPublicUrl(fileKey))
    : await saveFileLocally(fileKey, videoBuffer);

  const thrownAt = thrownAtStr ? new Date(thrownAtStr) : new Date();

  const entry = await prisma.codexEntry.create({
    data: {
      userId,
      event: event as "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN",
      implement,
      distance,
      videoUrl,
      fileSize: videoBlob.size,
      notes,
      thrownAt,
    },
  });

  return NextResponse.json({ ok: true, data: entry }, { status: 201 });
}
