import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { parseBody } from "@/lib/api-schemas";
import { logger } from "@/lib/logger";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  getPresignedUploadPartUrl,
  isR2Configured,
  saveFileLocally,
} from "@/lib/r2";

/**
 * Resumable clip upload for analysis (F2, decisions.md D3): S3 multipart on
 * R2 — per-part retry, resume from the last completed part. The client
 * uploads parts directly to presigned URLs; this route only mints/finalizes.
 *
 * Local dev (no R2): single-shot multipart FormData fallback.
 */

const ALLOWED_EXTS = new Set(["mp4", "mov", "webm", "m4v"]);
const MAX_PARTS = 200;

const InitSchema = z.object({
  action: z.literal("init"),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});
const SignPartSchema = z.object({
  action: z.literal("sign-part"),
  key: z.string().min(1),
  uploadId: z.string().min(1),
  partNumber: z.number().int().min(1).max(MAX_PARTS),
});
const CompleteSchema = z.object({
  action: z.literal("complete"),
  key: z.string().min(1),
  uploadId: z.string().min(1),
  parts: z
    .array(z.object({ PartNumber: z.number().int().min(1), ETag: z.string().min(1) }))
    .min(1),
});
const AbortSchema = z.object({
  action: z.literal("abort"),
  key: z.string().min(1),
  uploadId: z.string().min(1),
});
const ActionSchema = z.discriminatedUnion("action", [
  InitSchema,
  SignPartSchema,
  CompleteSchema,
  AbortSchema,
]);

function clipKey(userId: string, ext: string): string {
  return `analysis/clips/${userId}/${randomUUID()}.${ext}`;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Local-dev fallback: FormData single-shot.
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.startsWith("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ success: false, error: "Unsupported video format" }, { status: 400 });
    }
    const key = clipKey(session.userId, ext);
    await saveFileLocally(key, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ success: true, data: { key, mode: "local" } });
  }

  const parsed = await parseBody(request, ActionSchema);
  if (parsed instanceof NextResponse) return parsed;

  if (!isR2Configured()) {
    return NextResponse.json(
      { success: false, error: "Storage not configured — use the form-data fallback in dev" },
      { status: 503 }
    );
  }

  // Ownership: every action after init must reference a key under this user.
  if (parsed.action !== "init" && !parsed.key.startsWith(`analysis/clips/${session.userId}/`)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  switch (parsed.action) {
    case "init": {
      const ext = parsed.fileName.split(".").pop()?.toLowerCase() ?? "mp4";
      if (!ALLOWED_EXTS.has(ext)) {
        return NextResponse.json(
          { success: false, error: "Unsupported video format (mp4, mov, webm, m4v)" },
          { status: 400 }
        );
      }
      const key = clipKey(session.userId, ext);
      const uploadId = await createMultipartUpload(key, parsed.contentType);
      return NextResponse.json({ success: true, data: { key, uploadId, mode: "multipart" } });
    }
    case "sign-part": {
      const url = await getPresignedUploadPartUrl(parsed.key, parsed.uploadId, parsed.partNumber);
      return NextResponse.json({ success: true, data: { url } });
    }
    case "complete": {
      await completeMultipartUpload(parsed.key, parsed.uploadId, parsed.parts);
      return NextResponse.json({ success: true, data: { key: parsed.key } });
    }
    case "abort": {
      await abortMultipartUpload(parsed.key, parsed.uploadId).catch((err) => {
        logger.warn("analysis/uploads: abort failed", {
          metadata: { key: parsed.key },
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });
      return NextResponse.json({ success: true, data: { aborted: true } });
    }
  }
}
