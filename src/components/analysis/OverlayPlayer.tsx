"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { PhaseBoundary, SmoothedPose } from "@/lib/contracts";
import { PhaseTimeline } from "./PhaseTimeline";

/**
 * F8 in-app overlay: keypoint JSON drives a canvas layered over the video —
 * skeleton, joint markers, live angle readouts, phase timeline, frame-step.
 * Zero server cost, fully interactive. Works without a video URL (canvas-only
 * scrub mode) so results render even while the clip is still transcoding.
 */

const SKELETON_EDGES: Array<[number, number]> = [
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10], // arms
  [5, 11], [6, 12], [11, 12], // torso
  [11, 13], [13, 15], [12, 14], [14, 16], // legs
  [0, 5], [0, 6], // neck
];

const MIN_DRAW_CONF = 0.2;

function angleAt(
  kps: NonNullable<SmoothedPose["frames"][number]["keypoints"]>,
  a: number,
  b: number,
  c: number
): number | null {
  const [pa, pb, pc] = [kps[a], kps[b], kps[c]];
  if (pa.conf < MIN_DRAW_CONF || pb.conf < MIN_DRAW_CONF || pc.conf < MIN_DRAW_CONF) {
    return null;
  }
  const v1 = { x: pa.x - pb.x, y: pa.y - pb.y };
  const v2 = { x: pc.x - pb.x, y: pc.y - pb.y };
  const n1 = Math.hypot(v1.x, v1.y);
  const n2 = Math.hypot(v2.x, v2.y);
  if (!n1 || !n2) return null;
  const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / (n1 * n2)));
  return Math.round((Math.acos(cos) * 180) / Math.PI);
}

export interface OverlayPlayerProps {
  pose: SmoothedPose;
  phaseBoundaries?: PhaseBoundary[];
  videoUrl?: string | null;
}

export function OverlayPlayer({ pose, phaseBoundaries = [], videoUrl }: OverlayPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const frameCount = pose.frames.length;

  const currentPhase = useMemo(
    () =>
      phaseBoundaries.find((p) => frame >= p.startFrame && frame <= p.endFrame)?.phase ??
      null,
    [phaseBoundaries, frame]
  );

  // Keypoints live in extracted-frame pixel space, which equals the video's
  // DISPLAY dimensions — ffmpeg applies rotation metadata when extracting
  // frames, and the browser applies it when decoding. videoWidth/videoHeight
  // is therefore the truthful source size even for pose JSON produced before
  // probe() became rotation-aware; pose.resolution covers canvas-only mode.
  const sourceSize = useCallback(() => {
    const video = videoRef.current;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      return { w: video.videoWidth, h: video.videoHeight };
    }
    return { w: pose.resolution.width, h: pose.resolution.height };
  }, [pose]);

  const draw = useCallback(
    (f: number) => {
      const canvas = canvasRef.current;
      const box = containerRef.current?.getBoundingClientRect();
      if (!canvas || !box || box.width < 1 || box.height < 1) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const bitmapW = Math.round(box.width * dpr);
      const bitmapH = Math.round(box.height * dpr);
      if (canvas.width !== bitmapW) canvas.width = bitmapW;
      if (canvas.height !== bitmapH) canvas.height = bitmapH;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, box.width, box.height);
      if (!videoUrl || videoError) {
        ctx.fillStyle = "rgb(23 23 26)";
        ctx.fillRect(0, 0, box.width, box.height);
      }
      const kps = pose.frames[f]?.keypoints;
      if (!kps) return;

      // The <video> is CSS object-contain inside the same box; mirror that
      // letterboxing so the skeleton lands on the displayed athlete.
      const { w: sw, h: sh } = sourceSize();
      const scale = Math.min(box.width / sw, box.height / sh);
      const offX = (box.width - sw * scale) / 2;
      const offY = (box.height - sh * scale) / 2;

      const brand = getComputedStyle(canvas).getPropertyValue("--color-overlay-skeleton") || "";
      ctx.strokeStyle = brand.trim() || "rgb(255 200 0)";
      ctx.lineWidth = 2.5;
      for (const [a, b] of SKELETON_EDGES) {
        if (kps[a].conf < MIN_DRAW_CONF || kps[b].conf < MIN_DRAW_CONF) continue;
        ctx.beginPath();
        ctx.moveTo(offX + kps[a].x * scale, offY + kps[a].y * scale);
        ctx.lineTo(offX + kps[b].x * scale, offY + kps[b].y * scale);
        ctx.stroke();
      }
      ctx.fillStyle = "rgb(255 255 255)";
      for (const kp of kps) {
        if (kp.conf < MIN_DRAW_CONF) continue;
        ctx.beginPath();
        ctx.arc(offX + kp.x * scale, offY + kp.y * scale, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [pose, videoUrl, videoError, sourceSize]
  );

  useEffect(() => {
    frameRef.current = frame;
    draw(frame);
  }, [draw, frame]);

  // Geometry can change without `frame` changing: container resize (covers
  // orientation change) and the video's metadata arriving both invalidate
  // the box→source mapping.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => draw(frameRef.current));
    observer.observe(el);
    return () => observer.disconnect();
  }, [draw]);

  // Video sync: derive the displayed frame from video time while playing.
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const video = videoRef.current;
      if (video) {
        setFrame(Math.min(frameCount - 1, Math.round(video.currentTime * pose.fps)));
      } else {
        setFrame((f) => {
          const next = f + 1;
          if (next >= frameCount) {
            setPlaying(false);
            return f;
          }
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, frameCount, pose.fps]);

  const step = (delta: number) => {
    setPlaying(false);
    videoRef.current?.pause();
    setFrame((f) => {
      const next = Math.min(frameCount - 1, Math.max(0, f + delta));
      if (videoRef.current) videoRef.current.currentTime = next / pose.fps;
      return next;
    });
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (video) {
      if (playing) video.pause();
      else void video.play();
    }
    setPlaying((p) => !p);
  };

  const kps = pose.frames[frame]?.keypoints ?? null;
  const readouts = kps
    ? [
        { label: "R elbow", value: angleAt(kps, 6, 8, 10) },
        { label: "L knee", value: angleAt(kps, 11, 13, 15) },
        { label: "R knee", value: angleAt(kps, 12, 14, 16) },
      ].filter((r) => r.value !== null)
    : [];

  return (
    <div className="card p-4 space-y-3" data-testid="overlay-player">
      <div
        ref={containerRef}
        className="relative aspect-video w-full overflow-hidden rounded-lg bg-surface-950"
      >
        {videoUrl && !videoError ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="absolute inset-0 h-full w-full object-contain"
            playsInline
            muted
            preload="metadata"
            onLoadedMetadata={() => {
              // iOS Safari won't paint a first frame at t=0 without a poster;
              // a sub-frame seek forces decode. Skeleton frame 0 still maps
              // to t≈0. Then remap now that videoWidth/videoHeight are known.
              const video = videoRef.current;
              if (video && video.currentTime === 0) video.currentTime = 0.001;
              draw(frameRef.current);
            }}
            onError={() => setVideoError(true)}
            onEnded={() => setPlaying(false)}
          />
        ) : null}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          data-testid="overlay-canvas"
        />
        {videoError && (
          <p className="absolute bottom-2 left-3 rounded bg-[var(--surface-overlay)] px-2 py-0.5 text-micro text-muted">
            Clip playback unavailable — skeleton view only
          </p>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          {readouts.map((r) => (
            <span
              key={r.label}
              className="rounded bg-[var(--surface-overlay)] px-2 py-0.5 font-mono text-micro tabular-nums"
            >
              {r.label} {r.value}°
            </span>
          ))}
        </div>
      </div>

      <PhaseTimeline
        phaseBoundaries={phaseBoundaries}
        frameCount={frameCount}
        frame={frame}
        onSeek={(f) => {
          setPlaying(false);
          videoRef.current?.pause();
          if (videoRef.current) videoRef.current.currentTime = f / pose.fps;
          setFrame(f);
        }}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            className="rounded p-2 hover:bg-surface-50 dark:hover:bg-surface-800/50 active:scale-[0.97] transition-colors"
            aria-label="Previous frame"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="rounded p-2 hover:bg-surface-50 dark:hover:bg-surface-800/50 active:scale-[0.97] transition-colors"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <Pause className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className="rounded p-2 hover:bg-surface-50 dark:hover:bg-surface-800/50 active:scale-[0.97] transition-colors"
            aria-label="Next frame"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div className="font-mono text-caption tabular-nums text-muted" data-testid="frame-readout">
          frame {frame} / {frameCount - 1}
          {currentPhase ? ` · ${currentPhase.replace(/_/g, " ")}` : ""}
        </div>
      </div>
    </div>
  );
}
