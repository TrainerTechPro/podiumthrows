import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import {
  isR2Configured,
  saveFileLocally,
  MAX_VIDEO_SIZE_MB,
} from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    await requireCoachApi();

    if (isR2Configured()) {
      return NextResponse.json(
        { error: "Local upload is disabled when R2 is configured" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const key = formData.get("key") as string | null;

    if (!file || !key) {
      return NextResponse.json(
        { error: "file and key are required" },
        { status: 400 }
      );
    }

    // Validate size
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_VIDEO_SIZE_MB) {
      return NextResponse.json(
        { error: `File size must be under ${MAX_VIDEO_SIZE_MB}MB` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await saveFileLocally(key, buffer);

    return NextResponse.json({ publicUrl });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[upload-local] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
