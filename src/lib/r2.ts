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
  return process.env.R2_BUCKET_NAME!;
}

export function getPublicUrl(key: string): string {
  const baseUrl = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");
  return `${baseUrl}/${key}`;
}

export function extractR2KeyFromUrl(url: string): string | null {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) return null;
  const base = publicUrl.replace(/\/$/, "");
  if (!url.startsWith(base)) return null;
  return url.slice(base.length + 1);
}

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

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );
}

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
