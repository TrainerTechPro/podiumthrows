import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isR2Configured, uploadSingleFile, getPublicUrl, saveFileLocally } from "@/lib/r2";

export const maxDuration = 120;

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
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

/* ── POST — upload a throw video with metadata ── */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    if (videoBlob.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 500MB)" }, { status: 400 });
    }

    const ext = videoBlob.name?.split(".").pop()?.toLowerCase() || "mp4";
    const mimeType = videoBlob.type || "video/mp4";
    if (!ALLOWED_TYPES.includes(mimeType) && !["mp4", "mov", "webm", "avi", "mkv", "m4v", "3gp"].includes(ext)) {
      return NextResponse.json({ error: "Unsupported video format" }, { status: 400 });
    }

    // Upload video
    const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());
    const fileKey = `codex/${user.userId}/${randomUUID()}.${ext}`;
    let videoUrl: string;

    if (isR2Configured()) {
      await uploadSingleFile(fileKey, videoBuffer, mimeType);
      videoUrl = getPublicUrl(fileKey);
    } else {
      videoUrl = await saveFileLocally(fileKey, videoBuffer);
    }

    const thrownAt = thrownAtStr ? new Date(thrownAtStr) : new Date();

    const entry = await prisma.codexEntry.create({
      data: {
        userId: user.userId,
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
  } catch (err) {
    console.error("[POST /api/codex]", err);
    return NextResponse.json({ error: "Failed to upload codex entry" }, { status: 500 });
  }
}
