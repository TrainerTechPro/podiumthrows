/**
 * Design Tokens — Centralized color constants for JS/Canvas/SVG contexts
 *
 * Use Tailwind classes for CSS styling wherever possible.
 * These constants are ONLY for situations where raw hex values are needed:
 * - Canvas API (ctx.fillStyle, ctx.strokeStyle)
 * - SVG fill/stroke attributes requiring dynamic values
 * - Inline styles that need computed colors (e.g. RPE slider track)
 *
 * All values reference their corresponding Tailwind token where applicable.
 */

/* ── Semantic Score Colors (SVG fills for ScoreIndicator, LineChart, etc.) ── */

export const SCORE_FILL = {
  success: "#22c55e", // success-500
  warning: "#f59e0b", // warning-500
  danger: "#ef4444", // danger-500
} as const;

/* ── RPE Color Scale (1-10, green → amber → red) ── */

export function getRpeHex(rpe: number): string {
  if (rpe >= 8) return "#22c55e"; // success-500
  if (rpe >= 7) return "#84cc16"; // lime-500
  if (rpe >= 6) return "#eab308"; // yellow-500
  if (rpe >= 5) return "#f59e0b"; // primary-500
  if (rpe >= 4) return "#f97316"; // orange-500
  if (rpe >= 3) return "#ef4444"; // danger-500
  return "#dc2626"; // danger-600
}

/* ── Event Colors (Shot Put, Discus, Hammer, Javelin) ── */

export const EVENT_COLORS: Record<string, string> = {
  SP: "#D4915A", // warm terracotta
  DT: "#6A9FD8", // steel blue
  HT: "#5BB88A", // jade green
  JT: "#D46A6A", // soft red
};

/* ── Annotation Preset Colors ── */

export const ANNOTATION_PRESET_COLORS = [
  "#ef4444", // danger-500
  "#3b82f6", // info-500
  "#22c55e", // success-500
  "#eab308", // yellow-500
  "#ffffff", // white
  "#f97316", // orange-500
] as const;

/* ── Annotation Type → Color Map ── */

export const ANNOTATION_TYPE_COLORS: Record<string, string> = {
  line: "#3b82f6", // info-500
  arrow: "#f97316", // orange-500
  circle: "#22c55e", // success-500
  angle: "#a855f7", // violet-500
  freehand: "#ef4444", // danger-500
  text: "#eab308", // yellow-500
};

/* ── Deficit / Ratio Status Colors (for inline bar fills) ── */

export const RATIO_STATUS_COLORS: Record<string, string> = {
  above: "#10b981", // emerald-500
  within: "#3b82f6", // info-500
  below: "#f59e0b", // warning-500
  far: "#ef4444", // danger-500
};

/* ── Pose Overlay Colors (canvas drawing) ── */

export const POSE_COLORS = {
  skeleton: "#00ff88",
  joint: "#ffffff",
  angleArc: "rgba(255, 255, 255, 0.6)",
  labelBg: "rgba(0, 0, 0, 0.7)",
  labelText: "#ffffff",
} as const;

/* ── Canvas Overlay Colors (annotation text backgrounds) ── */

export const CANVAS_OVERLAY = {
  textBg: "rgba(0, 0, 0, 0.6)",
} as const;

/* ── Confetti Colors (PRCelebration) ── */

export const CONFETTI_COLORS = [
  "#f59e0b", // primary-500
  "#fbbf24", // primary-400
  "#f97316", // orange-500
  "#ef4444", // danger-500
  "#10b981", // emerald-500
  "#3b82f6", // info-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#ffffff", // white
] as const;

/* ── Brand Colors (for inline style contexts where Tailwind isn't available) ── */

export const BRAND = {
  primary: "#f59e0b", // primary-500
  primaryDark: "#d97706", // primary-600
} as const;

/* ── Default Chart Color ── */

export const CHART_DEFAULT_COLOR = "#f59e0b"; // primary-500

/* ── Fallback Colors (for unknown/missing values) ── */

export const FALLBACK_GRAY = "#9ca3af"; // surface-400 equivalent
