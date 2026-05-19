/**
 * Local audio upload fallback — used only when R2 is not configured.
 * Accepts a raw audio body and writes it to public/uploads/. Mirrors the
 * behavior of the local video upload fallback elsewhere in the codebase.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  saveFileLocally,
  isAllowedAudioType,
  MAX_AUDIO_SIZE_MB,
} from "@/lib/r2";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error:"Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return NextResponse.json({ success: false, error:"Missing key" }, { status: 400 });
    }

    // Key must belong to the uploading user — prevents writing into
    // another user's audio folder via a crafted key parameter.
    if (!key.startsWith(`audio/${session.userId}/`)) {
      return NextResponse.json({ success: false, error:"Forbidden" }, { status: 403 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!isAllowedAudioType(contentType)) {
      return NextResponse.json(
        { success: false, error:"Unsupported audio type." },
        { status: 400 }
      );
    }

    const arrayBuffer = await req.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_AUDIO_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error:`Audio file too large (max ${MAX_AUDIO_SIZE_MB}MB).` },
        { status: 400 }
      );
    }

    const publicUrl = await saveFileLocally(key, Buffer.from(arrayBuffer));

    return NextResponse.json({ success: true, data: { publicUrl } });
  } catch (err) {
    logger.error("POST /api/throws/comments/audio-upload-url/local", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error:"Couldn’t save audio." },
      { status: 500 }
    );
  }
}
