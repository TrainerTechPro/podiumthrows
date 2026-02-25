import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { unlink, writeFile, mkdir } from "fs/promises";
import path from "path";

/* ─── Environment ──────────────────────────────────────────────────────────── */

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "podium-throws-videos";
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

/* ─── R2 Check ─────────────────────────────────────────────────────────────── */

export function isR2Configured(): boolean {
  return !!(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ACCOUNT_ID);
}

/* ─── S3 Client (R2-compatible) ────────────────────────────────────────────── */

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (_s3Client) return _s3Client;

  if (!isR2Configured()) {
    throw new Error("R2 is not configured. Use local storage fallback.");
  }

  _s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });

  return _s3Client;
}

/* ─── Allowed file types ───────────────────────────────────────────────────── */

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime", // .mov
  "video/webm",
];

export const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm"];

export const MAX_VIDEO_SIZE_MB = 500;

export function isAllowedVideoType(contentType: string): boolean {
  return ALLOWED_VIDEO_TYPES.includes(contentType);
}

export function isAllowedVideoExtension(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return ALLOWED_VIDEO_EXTENSIONS.includes(ext);
}

/* ─── Generate storage key ─────────────────────────────────────────────────── */

export function generateVideoKey(
  coachId: string,
  fileName: string
): string {
  const ext = path.extname(fileName).toLowerCase();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `videos/${coachId}/${timestamp}-${random}${ext}`;
}

/* ─── Get public URL ───────────────────────────────────────────────────────── */

export function getPublicUrl(key: string): string {
  if (isR2Configured() && R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`;
  }
  // Local fallback — served from /uploads/
  return `/uploads/${key.replace(/^videos\//, "")}`;
}

/* ─── Presigned upload URL (R2 only) ───────────────────────────────────────── */

export async function getPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: 3600, // 1 hour
  });

  return {
    uploadUrl,
    publicUrl: getPublicUrl(key),
  };
}

/* ─── Local file save (dev fallback) ───────────────────────────────────────── */

export async function saveFileLocally(
  key: string,
  buffer: Buffer
): Promise<string> {
  // Strip "videos/" prefix for local storage
  const localPath = key.replace(/^videos\//, "");
  const fullPath = path.join(process.cwd(), "public", "uploads", localPath);

  // Ensure directory exists
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);

  return `/uploads/${localPath}`;
}

/* ─── Delete file ──────────────────────────────────────────────────────────── */

export async function deleteFile(key: string): Promise<void> {
  if (isR2Configured()) {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
  } else {
    // Local fallback
    const localPath = key.replace(/^videos\//, "");
    const fullPath = path.join(process.cwd(), "public", "uploads", localPath);
    try {
      await unlink(fullPath);
    } catch {
      // File might not exist — ignore
    }
  }
}

/* ─── Log warning on import if R2 not configured ───────────────────────────── */

if (typeof process !== "undefined" && !isR2Configured()) {
  console.warn(
    "⚠ R2 not configured — video uploads will use local filesystem (public/uploads/). " +
      "Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ACCOUNT_ID for production."
  );
}
