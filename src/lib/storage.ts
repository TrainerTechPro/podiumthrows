/**
 * Backwards-compatible re-export from unified r2.ts.
 * All storage logic now lives in src/lib/r2.ts.
 */
export {
  isR2Configured,
  getPublicUrl,
  extractR2KeyFromUrl,
  getPresignedUploadUrl,
  saveFileLocally,
  uploadSingleFile,
  deleteObject,
  deleteFile,
  generateVideoKey,
  generateImageKey,
  isAllowedVideoType,
  isAllowedVideoExtension,
  isAllowedImageType,
  isAllowedImageExtension,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_VIDEO_EXTENSIONS,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_VIDEO_SIZE_MB,
  MAX_IMAGE_SIZE_MB,
  createMultipartUpload,
  uploadPart,
  completeMultipartUpload,
  abortMultipartUpload,
  getPresignedUploadPartUrl,
  configureR2Cors,
  getPresignedDownloadUrl,
} from "./r2";
