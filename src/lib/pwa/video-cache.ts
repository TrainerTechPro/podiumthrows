// Offline video caching — stores .mp4 blobs in Cache Storage,
// metadata in IndexedDB for tracking and listing.

import { openDB, idbGet, idbGetAll, idbPut, idbDelete } from "./idb";

const VIDEO_CACHE_NAME = "offline-videos";
const VIDEO_STORE = "offline-videos";

export interface CachedVideoMeta {
  videoId: string;
  url: string;
  title: string;
  fileSizeMb: number;
  cachedAt: number;
}

/**
 * Download and cache a video for offline playback.
 * Returns a progress callback for UI updates.
 */
export async function cacheVideo(
  videoId: string,
  url: string,
  title: string,
  fileSizeMb: number,
  onProgress?: (percent: number) => void
): Promise<void> {
  // Fetch the video with progress tracking
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : fileSizeMb * 1024 * 1024;

  // Read the stream with progress
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (onProgress && total > 0) {
      onProgress(Math.min(100, Math.round((received / total) * 100)));
    }
  }

  // Reconstruct the response for cache storage
  const blob = new Blob(chunks as BlobPart[], {
    type: response.headers.get("content-type") || "video/mp4",
  });
  const cachedResponse = new Response(blob, {
    headers: {
      "Content-Type": blob.type,
      "Content-Length": String(blob.size),
    },
  });

  // Store in Cache Storage (keyed by the full URL so the SW can match)
  const cache = await caches.open(VIDEO_CACHE_NAME);
  await cache.put(new Request(url), cachedResponse);

  // Store metadata in IndexedDB
  const db = await openDB();
  const meta: CachedVideoMeta = {
    videoId,
    url,
    title,
    fileSizeMb: blob.size / (1024 * 1024),
    cachedAt: Date.now(),
  };
  await idbPut(db, VIDEO_STORE, meta);
  db.close();
}

/**
 * Remove a cached video from Cache Storage and IndexedDB.
 */
export async function removeCachedVideo(videoId: string): Promise<void> {
  // Get the URL from metadata
  const db = await openDB();
  const meta = await idbGet<CachedVideoMeta>(db, VIDEO_STORE, videoId);
  if (meta) {
    const cache = await caches.open(VIDEO_CACHE_NAME);
    await cache.delete(new Request(meta.url));
    await idbDelete(db, VIDEO_STORE, videoId);
  }
  db.close();
}

/**
 * Check if a video is cached.
 */
export async function isVideoCached(videoId: string): Promise<boolean> {
  const db = await openDB();
  const meta = await idbGet<CachedVideoMeta>(db, VIDEO_STORE, videoId);
  db.close();
  return !!meta;
}

/**
 * Get all cached video metadata.
 */
export async function getCachedVideos(): Promise<CachedVideoMeta[]> {
  const db = await openDB();
  const all = await idbGetAll<CachedVideoMeta>(db, VIDEO_STORE);
  db.close();
  return all;
}

/**
 * Get device storage estimate.
 */
export async function getStorageEstimate(): Promise<{
  usedMb: number;
  quotaMb: number;
}> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usedMb: Math.round((estimate.usage || 0) / (1024 * 1024)),
      quotaMb: Math.round((estimate.quota || 0) / (1024 * 1024)),
    };
  }
  return { usedMb: 0, quotaMb: 0 };
}
