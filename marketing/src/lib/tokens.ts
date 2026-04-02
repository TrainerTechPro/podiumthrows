/* ─── Design System Tokens ──────────────────────────────────────────────── */

export const COLORS = {
  background: "#0a0a0c",
  surface: "#101016",
  surfaceLight: "#16161e",
  cardBg: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,200,0,0.12)",
  gold: "#FFC800",
  goldDim: "rgba(255,200,0,0.08)",
  goldGlow: "rgba(255,200,0,0.2)",
  goldGlowStrong: "rgba(255,200,0,0.3)",
  muted: "#838390",
  foreground: "#e8e8ea",
  white: "#ffffff",

  success: "#00FF88",
  warning: "#FF8800",
  danger: "#FF2222",
  info: "#4488FF",
} as const;

export const EVENT_COLORS: Record<string, string> = {
  SHOT_PUT: "#D4915A",
  DISCUS: "#6A9FD8",
  HAMMER: "#5BB88A",
  JAVELIN: "#D46A6A",
};

export const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

export const STATUS_COLORS: Record<string, string> = {
  optimal: COLORS.success,
  marginal: COLORS.warning,
  concerning: COLORS.danger,
};

export const STATUS_SYMBOLS: Record<string, string> = {
  optimal: "\u2713",
  marginal: "~",
  concerning: "!",
};

export const CONFETTI_COLORS = [
  "#FFC800", "#FFD700", "#FF8800", "#FF2222",
  "#00FF88", "#4488FF", "#AA44FF", "#FF44AA", "#ffffff",
];

/* ─── Clip-path polygon for cut corners ─────────────────────────────────── */

export function cutCornerClipPath(size = 12) {
  return `polygon(0 0, calc(100% - ${size}px) 0, 100% ${size}px, 100% 100%, ${size}px 100%, 0 calc(100% - ${size}px))`;
}
