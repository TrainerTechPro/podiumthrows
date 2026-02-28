"use client";

import { useRef, useEffect, useCallback } from "react";
import {
  type PoseResult,
  type PoseLandmark,
  POSE_CONNECTIONS,
  THROWS_ANGLES,
  calculateAngle,
} from "./usePoseDetection";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  pose: PoseResult | null;
  /** Show joint angle labels */
  showAngles?: boolean;
  /** Skeleton line color */
  color?: string;
  /** Joint dot color */
  jointColor?: string;
  /** Line width */
  lineWidth?: number;
  /** Minimum landmark visibility to draw (0-1) */
  visibilityThreshold?: number;
  className?: string;
};

/* ─── Constants ───────────────────────────────────────────────────────────── */

const DEFAULT_COLOR = "#00ff88";
const DEFAULT_JOINT_COLOR = "#ffffff";
const DEFAULT_LINE_WIDTH = 2.5;
const DEFAULT_VISIBILITY = 0.5;
const JOINT_RADIUS = 4;
const ANGLE_ARC_RADIUS = 20;
const ANGLE_LABEL_OFFSET = 30;

/* ─── Component ───────────────────────────────────────────────────────────── */

export function PoseOverlay({
  pose,
  showAngles = true,
  color = DEFAULT_COLOR,
  jointColor = DEFAULT_JOINT_COLOR,
  lineWidth = DEFAULT_LINE_WIDTH,
  visibilityThreshold = DEFAULT_VISIBILITY,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Resize observer ─────────────────────────────────────────────── */

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  /* ── Draw skeleton ───────────────────────────────────────────────── */

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!pose || !pose.landmarks || pose.landmarks.length === 0) return;
    const lm = pose.landmarks;

    // Helper: convert normalized coords to canvas coords
    const toXY = (p: PoseLandmark): [number, number] => [p.x * w, p.y * h];

    // Helper: check if a landmark is visible enough
    const isVisible = (idx: number): boolean =>
      idx < lm.length && lm[idx].visibility >= visibilityThreshold;

    /* ── Draw connections (bones) ────────────────────────────── */

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const [i, j] of POSE_CONNECTIONS) {
      if (!isVisible(i) || !isVisible(j)) continue;

      const [x1, y1] = toXY(lm[i]);
      const [x2, y2] = toXY(lm[j]);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    /* ── Draw joint dots ────────────────────────────────────── */

    // Draw key joints only (shoulders, elbows, wrists, hips, knees, ankles)
    const keyJoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    for (const idx of keyJoints) {
      if (!isVisible(idx)) continue;
      const [x, y] = toXY(lm[idx]);

      // White filled dot with colored outline
      ctx.beginPath();
      ctx.arc(x, y, JOINT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = jointColor;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    /* ── Draw joint angles ──────────────────────────────────── */

    if (showAngles) {
      ctx.lineWidth = 1;

      for (const angle of Object.values(THROWS_ANGLES)) {
        const { a, b, c, label } = angle;
        if (!isVisible(a) || !isVisible(b) || !isVisible(c)) continue;

        const degrees = calculateAngle(lm[a], lm[b], lm[c]);
        const [bx, by] = toXY(lm[b]);
        const [ax, ay] = toXY(lm[a]);
        const [cx, cy] = toXY(lm[c]);

        // Draw angle arc
        const startAngle = Math.atan2(ay - by, ax - bx);
        const endAngle = Math.atan2(cy - by, cx - bx);

        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.arc(bx, by, ANGLE_ARC_RADIUS, startAngle, endAngle);
        ctx.stroke();

        // Draw angle label
        const midAngle = (startAngle + endAngle) / 2;
        const labelX = bx + ANGLE_LABEL_OFFSET * Math.cos(midAngle);
        const labelY = by + ANGLE_LABEL_OFFSET * Math.sin(midAngle);

        // Background pill
        const text = `${Math.round(degrees)}°`;
        ctx.font = "bold 10px sans-serif";
        const metrics = ctx.measureText(`${label} ${text}`);
        const pillW = metrics.width + 8;
        const pillH = 16;

        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.beginPath();
        ctx.roundRect(
          labelX - pillW / 2,
          labelY - pillH / 2,
          pillW,
          pillH,
          4
        );
        ctx.fill();

        // Label text
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${label} ${text}`, labelX, labelY);
      }
    }
  }, [pose, color, jointColor, lineWidth, showAngles, visibilityThreshold]);

  /* ── Re-render on pose change ───────────────────────────────── */

  useEffect(() => {
    render();
  }, [render]);

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none ${className ?? ""}`}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}
