import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import prisma from "@/lib/prisma";

/* ─── GET — Poll video status ─────────────────────────────────────────────── *
 *
 * Light endpoint for polling. Returns only the status fields
 * so the client can detect when a video transitions from
 * "uploading"/"processing" to "ready" or "failed".
 * ─────────────────────────────────────────────────────────────────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachApi();

    const video = await prisma.videoUpload.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: {
        id: true,
        status: true,
        transcodeStatus: true,
        thumbnailUrl: true,
        transcodedUrl: true,
        durationSec: true,
      },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json(video);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[videos/[id]/status] GET Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ─── PATCH — Update video status ─────────────────────────────────────────── *
 *
 * Allows the upload form (or background jobs) to transition video status.
 *
 * Valid transitions:
 *   "uploading" → "processing" | "failed"
 *   "processing" → "ready" | "failed"
 *   "failed" → "uploading" (retry)
 *
 * Body: { status: string }
 * ─────────────────────────────────────────────────────────────────────────── */

const VALID_TRANSITIONS: Record<string, string[]> = {
  uploading: ["processing", "failed"],
  processing: ["ready", "failed"],
  failed: ["uploading"],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachApi();

    const video = await prisma.videoUpload.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true, status: true },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const body = await req.json();
    const { status } = body as { status?: string };

    if (!status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    const allowed = VALID_TRANSITIONS[video.status];
    if (!allowed || !allowed.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition from "${video.status}" to "${status}"` },
        { status: 409 }
      );
    }

    await prisma.videoUpload.update({
      where: { id: params.id },
      data: { status },
    });

    return NextResponse.json({ videoId: params.id, status });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[videos/[id]/status] PATCH Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
