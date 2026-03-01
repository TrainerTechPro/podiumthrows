"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ANALYSIS_FPS } from "./types";

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

      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      video.preload = "auto";
      videoRef.current = video;

      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d", {
        willReadFrequently: true,
      });

      if (!tempCtx) {
        setError("Could not create canvas context");
        setIsExtracting(false);
        return;
      }

      const runExtraction = async () => {
        try {
          // Wait for metadata
          video.src = videoUrl;
          video.load();

          await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => resolve();
            video.onerror = () =>
              reject(new Error("Failed to load video metadata"));
            // Timeout after 15 seconds
            setTimeout(() => reject(new Error("Video metadata timeout")), 15000);
          });

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

            // Seek to exact time
            video.currentTime = targetTime;
            await new Promise<void>((resolve) => {
              video.onseeked = () => resolve();
            });

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
          const msg =
            err instanceof Error ? err.message : "Frame extraction failed";
          setError(msg);
          setIsExtracting(false);
        } finally {
          // Clean up hidden video element
          video.src = "";
          video.load();
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
