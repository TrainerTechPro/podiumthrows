"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ANALYSIS_FPS } from "./types";
import { csrfHeaders } from "@/lib/csrf-client";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Resolution = "full" | "half" | "quarter";

type Options = {
  /** Max clip duration to extract in seconds (default 10) */
  maxDuration?: number;
  /** Extraction resolution relative to source (default "half") */
  resolution?: Resolution;
  /** FPS for frame extraction (default ANALYSIS_FPS = 60) */
  fps?: number;
};

type FrameExtractorReturn = {
  /** Extracted frames — stable ref, updated in-place during extraction */
  frames: ImageBitmap[];
  /** Whether extraction is currently running */
  isExtracting: boolean;
  /** Extraction progress 0-100 */
  progress: number;
  /** Error message if extraction failed */
  error: string | null;
  /** Total frame count (set after extraction completes) */
  totalFrames: number;
  /** Source video dimensions (set after metadata loads) */
  sourceWidth: number;
  sourceHeight: number;
  /** Canvas dimensions used for extraction */
  canvasWidth: number;
  canvasHeight: number;
  /** Start extraction from the given video URL */
  extract: (videoUrl: string) => void;
  /** Cancel in-progress extraction */
  cancel: () => void;
  /** Release all ImageBitmap memory */
  cleanup: () => void;
};

/* ─── Resolution multipliers ──────────────────────────────────────────────── */

function resolutionScale(res: Resolution): number {
  switch (res) {
    case "full":
      return 1;
    case "half":
      return 0.5;
    case "quarter":
      return 0.25;
  }
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/** Check if a URL is cross-origin relative to the current page */
function isCrossOrigin(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/** Wait for a video event with a timeout */
function waitForEvent(
  video: HTMLVideoElement,
  eventName: string,
  timeoutMs: number,
  errorMsg: string
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        video.removeEventListener(eventName, handler);
        reject(new Error(errorMsg));
      }
    }, timeoutMs);

    function handler() {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        video.removeEventListener(eventName, handler);
        resolve();
      }
    }

    video.addEventListener(eventName, handler);
  });
}

/**
 * Ensure R2 CORS is configured (one-time server-side operation).
 * Called automatically before extraction for cross-origin videos.
 * Idempotent — safe to call multiple times.
 */
async function ensureCors(): Promise<void> {
  try {
    const res = await fetch("/api/admin/ensure-cors", { method: "POST", headers: csrfHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.warn("[useFrameExtractor] CORS setup returned", res.status, data);
    }
  } catch (err) {
    console.warn("[useFrameExtractor] CORS setup request failed:", err);
  }
}

/* ─── Hook ────────────────────────────────────────────────────────────────── */

export function useFrameExtractor(options: Options = {}): FrameExtractorReturn {
  const {
    maxDuration = 10,
    resolution = "half",
    fps = ANALYSIS_FPS,
  } = options;

  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [totalFrames, setTotalFrames] = useState(0);
  const [sourceWidth, setSourceWidth] = useState(0);
  const [sourceHeight, setSourceHeight] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);

  // Stable refs — avoid re-renders during extraction
  const framesRef = useRef<ImageBitmap[]>([]);
  const cancelledRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Force a re-render when frames array is fully populated
  const [, forceUpdate] = useState(0);

  /* ── Cleanup all ImageBitmaps ────────────────────────────────────────── */

  const cleanup = useCallback(() => {
    for (const frame of framesRef.current) {
      frame.close();
    }
    framesRef.current = [];
    setTotalFrames(0);
    setProgress(0);
    setError(null);
    forceUpdate((n) => n + 1);
  }, []);

  /* ── Cancel in-progress extraction ───────────────────────────────────── */

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  /* ── Extract frames ──────────────────────────────────────────────────── */

  const extract = useCallback(
    (videoUrl: string) => {
      // Reset state
      cleanup();
      cancelledRef.current = false;
      setIsExtracting(true);
      setError(null);
      setProgress(0);

      const runExtraction = async () => {
        // If cross-origin, ensure R2 CORS is configured first
        const crossOrigin = isCrossOrigin(videoUrl);
        if (crossOrigin) {
          await ensureCors();
        }

        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";
        videoRef.current = video;

        // Only set crossOrigin for cross-origin URLs — setting it on same-origin
        // URLs is fine but unnecessary. For cross-origin, it's REQUIRED so that
        // drawImage() doesn't taint the canvas and createImageBitmap() works.
        if (crossOrigin) {
          video.crossOrigin = "anonymous";
        }

        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d", {
          willReadFrequently: true,
        });

        if (!tempCtx) {
          setError("Could not create canvas context");
          setIsExtracting(false);
          return;
        }

        try {
          // Wait for metadata (with timeout)
          video.src = videoUrl;
          video.load();

          await waitForEvent(video, "loadedmetadata", 15000, "Video metadata timeout");

          // Also wait for enough data to be buffered for seeking
          if (video.readyState < 2) {
            await waitForEvent(video, "loadeddata", 15000, "Video data load timeout");
          }

          const srcW = video.videoWidth;
          const srcH = video.videoHeight;
          setSourceWidth(srcW);
          setSourceHeight(srcH);

          const scale = resolutionScale(resolution);
          const cW = Math.round(srcW * scale);
          const cH = Math.round(srcH * scale);
          tempCanvas.width = cW;
          tempCanvas.height = cH;
          setCanvasWidth(cW);
          setCanvasHeight(cH);

          // Clamp duration
          const clipDuration = Math.min(video.duration, maxDuration);
          const frameDuration = 1 / fps;
          const numFrames = Math.floor(clipDuration * fps);

          const extractedFrames: ImageBitmap[] = [];

          for (let i = 0; i <= numFrames; i++) {
            if (cancelledRef.current) {
              // Clean up partial extraction
              for (const f of extractedFrames) f.close();
              setIsExtracting(false);
              setProgress(0);
              return;
            }

            const targetTime = i * frameDuration;

            // Seek to exact time with timeout (5s per frame seek)
            video.currentTime = targetTime;
            await waitForEvent(video, "seeked", 5000, `Seek stalled at frame ${i}/${numFrames} (t=${targetTime.toFixed(3)}s)`);

            // Draw to temp canvas at extraction resolution
            tempCtx.drawImage(video, 0, 0, cW, cH);

            // Create high-performance ImageBitmap
            const bitmap = await createImageBitmap(tempCanvas);
            extractedFrames.push(bitmap);

            // Update progress (avoid too-frequent state updates)
            if (i % 5 === 0 || i === numFrames) {
              setProgress(Math.round((i / numFrames) * 100));
            }
          }

          // Store in ref and trigger final re-render
          framesRef.current = extractedFrames;
          setTotalFrames(extractedFrames.length);
          setProgress(100);
          setIsExtracting(false);
          forceUpdate((n) => n + 1);
        } catch (err) {
          let msg =
            err instanceof Error ? err.message : "Frame extraction failed";

          // Provide helpful CORS error message
          if (
            crossOrigin &&
            (msg.includes("tainted") ||
              msg.includes("SecurityError") ||
              msg.includes("Failed to load video"))
          ) {
            msg =
              "Cross-origin video blocked (CORS). The R2 bucket may need CORS configuration. " +
              "Try refreshing and retrying — CORS was just configured automatically.";
          }

          setError(msg);
          setIsExtracting(false);
        } finally {
          // Clean up hidden video element
          if (video) {
            video.src = "";
            video.load();
          }
          videoRef.current = null;
        }
      };

      runExtraction();
    },
    [cleanup, fps, maxDuration, resolution]
  );

  /* ── Cleanup on unmount ──────────────────────────────────────────────── */

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      for (const frame of framesRef.current) {
        frame.close();
      }
      framesRef.current = [];
      if (videoRef.current) {
        videoRef.current.src = "";
        videoRef.current.load();
      }
    };
  }, []);

  return {
    frames: framesRef.current,
    isExtracting,
    progress,
    error,
    totalFrames,
    sourceWidth,
    sourceHeight,
    canvasWidth,
    canvasHeight,
    extract,
    cancel,
    cleanup,
  };
}
