import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession } from "@/lib/data/coach";
import { isR2Configured, saveFileLocally, MAX_IMAGE_SIZE_MB } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    await requireCoachSession();

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
      return NextResponse.json({ error: "file and key are required" }, { status: 400 });
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_IMAGE_SIZE_MB) {
      return NextResponse.json(
        { error: `Thumbnail too large (max ${MAX_IMAGE_SIZE_MB}MB)` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await saveFileLocally(key, buffer);
    return NextResponse.json({ publicUrl });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
