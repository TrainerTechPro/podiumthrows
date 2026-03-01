"use client";

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  /** Array of pre-extracted frames (ImageBitmap[]) */
  frames: ImageBitmap[];
  /** Current frame index to display */
  currentFrame: number;
  /** Canvas render width (pixels). Falls back to first frame's width */
  width?: number;
  /** Canvas render height (pixels). Falls back to first frame's height */
  height?: number;
  className?: string;
};

export type CanvasFrameRendererHandle = {
  getCanvas: () => HTMLCanvasElement | null;
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export const CanvasFrameRenderer = forwardRef<CanvasFrameRendererHandle, Props>(
  function CanvasFrameRenderer(
    { frames, currentFrame, width, height, className },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const lastDrawnFrame = useRef(-1);

    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
    }), []);

    /* ── Compute aspect ratio from frames ──────────────────────────────── */

    const firstFrame = frames.length > 0 ? frames[0] : null;
    const frameW = width ?? (firstFrame?.width ?? 0);
    const frameH = height ?? (firstFrame?.height ?? 0);
    const aspectRatio = frameW > 0 && frameH > 0 ? `${frameW} / ${frameH}` : undefined;

    /* ── Draw current frame to canvas ──────────────────────────────────── */

    const drawFrame = useCallback(
      (index: number) => {
        const canvas = canvasRef.current;
        if (!canvas || frames.length === 0) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const safeIndex = Math.max(0, Math.min(index, frames.length - 1));
        const bitmap = frames[safeIndex];
        if (!bitmap) return;

        // Set canvas internal resolution from bitmap if not explicitly provided
        const w = width ?? bitmap.width;
        const h = height ?? bitmap.height;

        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;

        ctx.drawImage(bitmap, 0, 0, w, h);
        lastDrawnFrame.current = safeIndex;
      },
      [frames, width, height]
    );

    /* ── Redraw when frame index changes ───────────────────────────────── */

    useEffect(() => {
      if (currentFrame !== lastDrawnFrame.current) {
        drawFrame(currentFrame);
      }
    }, [currentFrame, drawFrame]);

    /* ── Draw first frame when frames become available ─────────────────── */

    useEffect(() => {
      if (frames.length > 0 && lastDrawnFrame.current === -1) {
        drawFrame(0);
      }
    }, [frames, drawFrame]);

    /*
     * CSS `object-contain` does NOT work on <canvas> elements — it only
     * applies to replaced elements like <img> and <video>. To achieve the
     * same letterboxing effect we wrap the canvas in a flex-centered
     * container and use CSS `aspect-ratio` to size the canvas correctly.
     * The canvas scales via `max-w-full max-h-full` while maintaining its
     * intrinsic aspect ratio, producing proper letterboxing for both
     * landscape and portrait source video.
     */
    return (
      <div className={`flex items-center justify-center w-full h-full ${className ?? ""}`}>
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full"
          style={{
            imageRendering: "auto",
            aspectRatio,
          }}
        />
      </div>
    );
  }
);
