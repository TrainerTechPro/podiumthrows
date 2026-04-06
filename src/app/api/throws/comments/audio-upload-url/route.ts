/**
 * Audio Upload URL — returns a presigned R2 upload URL for a voice note.
 * The client PUTs the recorded blob directly to the URL, then calls the
 * comments POST endpoint with the resulting publicUrl as `audioUrl`.
 *
 * Auth: any logged-in user. Access to the target (which throw/session the
 * comment will eventually attach to) is verified when the comment itself
 * is created — this endpoint only mints an upload URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  generateAudioKey,
  getPresignedUploadUrl,
  isAllowedAudioType,
  MAX_AUDIO_SIZE_MB,
  isR2Configured,
  getPublicUrl,
} from "@/lib/r2";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const contentType =
      typeof body.contentType === "string" ? body.contentType : null;
    const sizeBytes =
      typeof body.sizeBytes === "number" ? body.sizeBytes : null;

    if (!contentType || !isAllowedAudioType(contentType)) {
      return NextResponse.json(
        { error: "Unsupported audio type. Supported: webm, ogg, mp4/m4a, mp3, aac." },
        { status: 400 }
      );
    }
    if (sizeBytes != null && sizeBytes > MAX_AUDIO_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Audio file too large (max ${MAX_AUDIO_SIZE_MB}MB).` },
        { status: 400 }
      );
    }

    // Pick an extension from the MIME type
    const base = contentType.split(";")[0].trim().toLowerCase();
    const extMap: Record<string, string> = {
      "audio/webm": ".webm",
      "audio/ogg": ".ogg",
      "audio/mp4": ".m4a",
      "audio/x-m4a": ".m4a",
      "audio/mpeg": ".mp3",
      "audio/aac": ".aac",
    };
    const ext = extMap[base] ?? ".webm";
    const key = generateAudioKey(session.userId, ext);

    if (!isR2Configured()) {
      // Dev / local fallback: return a direct POST URL to the local
      // upload endpoint. The client handles both flavors transparently.
      return NextResponse.json({
        uploadUrl: `/api/throws/comments/audio-upload-url/local?key=${encodeURIComponent(key)}`,
        publicUrl: getPublicUrl(key),
        key,
        mode: "local",
      });
    }

    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType);

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      key,
      mode: "r2",
    });
  } catch (err) {
    logger.error("POST /api/throws/comments/audio-upload-url", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to get upload URL." },
      { status: 500 }
    );
  }
}
