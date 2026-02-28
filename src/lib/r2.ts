import {
  S3Client,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutBucketCorsCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

/* ─── Environment ──────────────────────────────────────────────────────────── */

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "podium-throws-videos";

/* ─── R2 Check ─────────────────────────────────────────────────────────────── */

let r2Client: S3Client | null = null;

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  );
}

/* ─── S3 Client (R2-compatible) ────────────────────────────────────────────── */

function getClient(): S3Client {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return r2Client;
}

function getBucket(): string {
  return R2_BUCKET_NAME;
}

/* ─── Public URL ───────────────────────────────────────────────────────────── */

export function getPublicUrl(key: string): string {
  if (isR2Configured() && process.env.R2_PUBLIC_URL) {
    const baseUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, "");
    return `${baseUrl}/${key}`;
  }
  // Local fallback — served from /uploads/
  return `/uploads/${key.replace(/^videos\//, "")}`;
}

export function extractR2KeyFromUrl(url: string): string | null {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) return null;
  const base = publicUrl.replace(/\/$/, "");
  if (!url.startsWith(base)) return null;
  return url.slice(base.length + 1);
}

/* ─── Allowed file types ───────────────────────────────────────────────────── */

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime", // .mov
  "video/webm",
  "video/hevc",      // iPhone HEVC recordings
  "video/x-m4v",     // .m4v
  "video/3gpp",      // .3gp (mobile recordings)
];

export const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v", ".3gp"];

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

export const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"];

export const MAX_VIDEO_SIZE_MB = 500;
export const MAX_IMAGE_SIZE_MB = 15;

export function isAllowedVideoType(contentType: string): boolean {
  return ALLOWED_VIDEO_TYPES.includes(contentType);
}

export function isAllowedVideoExtension(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return ALLOWED_VIDEO_EXTENSIONS.includes(ext);
}

export function isAllowedImageType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(contentType);
}

export function isAllowedImageExtension(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return ALLOWED_IMAGE_EXTENSIONS.includes(ext);
}

/* ─── Generate storage key ─────────────────────────────────────────────────── */

export function generateVideoKey(coachId: string, fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `videos/${coachId}/${timestamp}-${random}${ext}`;
}

export function generateImageKey(userId: string, fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `images/${userId}/${timestamp}-${random}${ext}`;
}

/* ─── Presigned upload URL (R2 only) ───────────────────────────────────────── */

export async function getPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
  return { uploadUrl, publicUrl: getPublicUrl(key) };
}

/* ─── Local file save (dev fallback) ───────────────────────────────────────── */

export async function saveFileLocally(
  key: string,
  buffer: Buffer
): Promise<string> {
  // Strip common prefixes for local storage
  const localPath = key.replace(/^(videos|images|uploads)\//, "");
  const fullPath = path.join(process.cwd(), "public", "uploads", localPath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  return `/uploads/${localPath}`;
}

/* ─── Upload single file ───────────────────────────────────────────────────── */

export async function uploadSingleFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/* ─── Delete ───────────────────────────────────────────────────────────────── */

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );
}

/** Delete file from R2 or local filesystem */
export async function deleteFile(key: string): Promise<void> {
  if (isR2Configured()) {
    await deleteObject(key);
  } else {
    const localPath = key.replace(/^(videos|images|uploads)\//, "");
    const fullPath = path.join(process.cwd(), "public", "uploads", localPath);
    try {
      await unlink(fullPath);
    } catch {
      // File might not exist — ignore
    }
  }
}

/* ─── Multipart Upload ─────────────────────────────────────────────────────── */

export async function createMultipartUpload(
  key: string,
  contentType: string
): Promise<string> {
  const result = await getClient().send(
    new CreateMultipartUploadCommand({
      Bucket: getBucket(),
      Key: key,
      ContentType: contentType,
    })
  );
  return result.UploadId!;
}

export async function uploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  body: Buffer
): Promise<string> {
  const result = await getClient().send(
    new UploadPartCommand({
      Bucket: getBucket(),
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body,
    })
  );
  return result.ETag!;
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[]
): Promise<void> {
  await getClient().send(
    new CompleteMultipartUploadCommand({
      Bucket: getBucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    })
  );
}

export async function abortMultipartUpload(
  key: string,
  uploadId: string
): Promise<void> {
  await getClient().send(
    new AbortMultipartUploadCommand({
      Bucket: getBucket(),
      Key: key,
      UploadId: uploadId,
    })
  );
}

export async function getPresignedUploadPartUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn: number = 1800
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: getBucket(),
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(getClient(), command, { expiresIn });
}

/* ─── CORS Config ──────────────────────────────────────────────────────────── */

export async function configureR2Cors(): Promise<void> {
  await getClient().send(
    new PutBucketCorsCommand({
      Bucket: getBucket(),
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ["*"],
            AllowedMethods: ["GET", "HEAD", "PUT", "OPTIONS"],
            AllowedHeaders: [
              "Range",
              "Authorization",
              "Content-Type",
              "x-amz-*",
            ],
            ExposeHeaders: [
              "Content-Length",
              "Content-Range",
              "Accept-Ranges",
              "ETag",
            ],
            MaxAgeSeconds: 86400,
          },
        ],
      },
    })
  );
}

/* ─── Presigned Download ───────────────────────────────────────────────────── */

export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ResponseContentType: key.endsWith(".mov") ? "video/quicktime" : "video/mp4",
  });
  return getSignedUrl(getClient(), command, { expiresIn });
}

/* ─── Dev warning ──────────────────────────────────────────────────────────── */

if (typeof process !== "undefined" && !isR2Configured()) {
  console.warn(
    "⚠ R2 not configured — uploads will use local filesystem (public/uploads/). " +
      "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL for production."
  );
}
