import { NextRequest, NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { getSession } from "@/lib/auth";
import { localArtifactPath } from "@/lib/analysis/storage";

/**
 * Dev-only file server for local analysis artifacts (.local-storage/analysis/).
 * Exists so the R2-unconfigured fallback never writes into public/ — anything
 * there ships with every deploy. In production this route is a hard 404;
 * production artifacts are presigned R2 GETs from the artifacts route.
 */

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await params;
  const root = path.resolve(localArtifactPath("analysis"));
  const resolved = path.resolve(localArtifactPath(key.join("/")));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return NextResponse.json({ success: false, error: "Invalid artifact key" }, { status: 400 });
  }

  if (!existsSync(resolved) || !statSync(resolved).isFile()) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const stream = Readable.toWeb(createReadStream(resolved)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "content-type": CONTENT_TYPES[path.extname(resolved).toLowerCase()] ?? "application/octet-stream",
      "content-length": String(statSync(resolved).size),
      "cache-control": "no-store",
    },
  });
}
