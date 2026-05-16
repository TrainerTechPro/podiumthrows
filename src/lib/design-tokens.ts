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
  success: "#00FF88", // success-500 (cyber green)
  warning: "#FF8800", // warning-500 (cyber orange)
  danger: "#FF2222", // danger-500 (cyber red)
} as const;

/* ── RPE Color Scale (1-10, green → amber → red) ── */

export function getRpeHex(rpe: number): string {
  if (rpe >= 8) return "#00FF88"; // cyber green
  if (rpe >= 7) return "#66FF66"; // bright lime
  if (rpe >= 6) return "#FFC800"; // cyber gold
  if (rpe >= 5) return "#FF8800"; // cyber orange
  if (rpe >= 4) return "#FF6600"; // hot orange
  if (rpe >= 3) return "#FF2222"; // cyber red
  return "#CC1A1A"; // deep red
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
  above: "#00FF88", // cyber green
  within: "#4488FF", // cyber blue
  below: "#FF8800", // cyber orange
  far: "#FF2222", // cyber red
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
  "#FFC800", // cyber gold
  "#FFD700", // bright gold
  "#FF8800", // cyber orange
  "#FF2222", // cyber red
  "#00FF88", // cyber green
  "#4488FF", // cyber blue
  "#AA44FF", // cyber purple
  "#FF44AA", // neon pink
  "#ffffff", // white
] as const;

/* ── Brand Colors (for inline style contexts where Tailwind isn't available) ── */

export const BRAND = {
  primary: "#FFC800", // cyber gold
  primaryDark: "#e6b400", // darker gold
} as const;

/* ── Default Chart Color ── */

export const CHART_DEFAULT_COLOR = "#FFC800"; // cyber gold

/* ── Wellness-factor series colors ────────────────────────────────────────
   These live here (not Tailwind classes) because chart series colors
   feed into SVG `stroke` / `fill` attributes that can't reference CSS
   custom properties cross-browser without quirks. Keep semantic intent in
   the keys — components reference WELLNESS_FACTOR_COLORS.sleep, not raw
   hex. */
export const WELLNESS_FACTOR_COLORS = {
  sleep: "#3b82f6", // calm blue — rest factor
  soreness: "#f59e0b", // warm amber — fatigue indicator
  stress: "#8b5cf6", // cool violet — mental load
  energy: "#10b981", // grounded green — vitality
} as const;

/* ── Fallback Colors (for unknown/missing values) ── */

export const FALLBACK_GRAY = "#9ca3af"; // surface-400 equivalent
