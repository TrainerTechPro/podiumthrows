/* ─── Annotation Types ─────────────────────────────────────────────────────── */

export type AnnotationType =
  | "line"
  | "arrow"
  | "circle"
  | "angle"
  | "freehand"
  | "text";

export type Point = {
  x: number; // normalized 0-1 (percentage of video width)
  y: number; // normalized 0-1 (percentage of video height)
};

export type Annotation = {
  id: string;
  timestamp: number;  // video time in seconds
  duration: number;   // how long visible (seconds, default 3)
  type: AnnotationType;
  points: Point[];
  color: string;      // hex color
  strokeWidth: number; // px
  text?: string;
  fontSize?: number;
};

/* ─── Tool Types ───────────────────────────────────────────────────────────── */

export type AnnotationTool =
  | "select"
  | "line"
  | "arrow"
  | "circle"
  | "angle"
  | "freehand"
  | "text";

/* ─── Preset Colors ────────────────────────────────────────────────────────── */

export const ANNOTATION_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#22c55e", // green
  "#eab308", // yellow
  "#ffffff", // white
  "#f97316", // orange
];

export const STROKE_WIDTHS = [
  { label: "Thin", value: 2 },
  { label: "Medium", value: 4 },
  { label: "Thick", value: 6 },
];

export const DEFAULT_ANNOTATION_DURATION = 3; // seconds

/* ─── Frame Constants (60fps sports analysis) ─────────────────────────────── */

/** Standard high-speed sports camera FPS for throws analysis */
export const ANALYSIS_FPS = 60;

/** Exact duration of one frame at 60fps (0.016667s) */
export const FRAME_STEP = 1 / ANALYSIS_FPS;

/** Snap a raw time value to the nearest exact frame boundary */
export function snapToFrame(rawTime: number, fps: number = ANALYSIS_FPS): number {
  const step = 1 / fps;
  return Math.round(rawTime / step) * step;
}

/* ─── Frame ↔ Time Conversion ─────────────────────────────────────────────── */

/** Convert a frame array index to a video time in seconds */
export function frameIndexToTime(index: number, fps: number = ANALYSIS_FPS): number {
  return index / fps;
}

/** Convert a video time in seconds to the nearest frame array index */
export function timeToFrameIndex(time: number, fps: number = ANALYSIS_FPS): number {
  return Math.round(time * fps);
}

/* ─── Speed Options ────────────────────────────────────────────────────────── */

export const PLAYBACK_SPEEDS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2];

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

export function generateAnnotationId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
}

export function isAnnotationVisible(
  annotation: Annotation,
  currentTime: number
): boolean {
  return (
    currentTime >= annotation.timestamp &&
    currentTime <= annotation.timestamp + annotation.duration
  );
}
