/**
 * Per-event, per-phase, and per-implement-tier color constants for the
 * coach throws surfaces (pulse table, phase distribution bars, implement
 * split bars). Lives in `src/lib/` because:
 *
 * 1. These must render as inline `style={{ backgroundColor: ... }}` —
 *    Tailwind cannot generate `bg-[#${hex}]` at build time when the hex
 *    is dynamic (`row.event` chooses the color per row).
 * 2. CLAUDE.md §Color tokens whitelists per-event domain colors. Moving
 *    them out of `src/app/` keeps the hex-lint scope clean and gives the
 *    coach throws view one canonical color source.
 *
 * If you need a new event/phase color, edit it here — don't reinline
 * a hex anywhere in the app surface.
 */

import type { TrainingPhase } from "./constants";

/* ─── Event ──────────────────────────────────────────────────────────────── */

/** Per-event domain colors. Used as inline backgrounds + dot indicators. */
export const EVENT_COLORS: Record<string, string> = {
  SP: "#f59e0b",
  DT: "#3b82f6",
  HT: "#10b981",
  JT: "#ef4444",
};

/** Fallback when an event code falls outside the known set. */
export const EVENT_COLOR_FALLBACK = "#d4a843";

/** Short visual labels for event chips. */
export const EVENT_LABELS_SHORT: Record<string, string> = {
  SP: "Shot",
  DT: "Disc",
  HT: "Hamm",
  JT: "Jav",
};

/* ─── Phase ──────────────────────────────────────────────────────────────── */

/** Bondarchuk periodization phase colors. */
export const PHASE_COLORS: Record<TrainingPhase, string> = {
  ACCUMULATION: "#f59e0b",
  TRANSMUTATION: "#10b981",
  REALIZATION: "#f97316",
  COMPETITION: "#ef4444",
  CLEANSE: "#8b5cf6",
};

export const PHASE_LABELS_SHORT: Record<string, string> = {
  ACCUMULATION: "Accum",
  TRANSMUTATION: "Trans",
  REALIZATION: "Real",
  COMPETITION: "Comp",
};

/* ─── Implement tier ─────────────────────────────────────────────────────── */

/** Heavy / competition / light implement bar colors. */
export const IMPLEMENT_TIER_COLORS = {
  heavy: "#ef4444",
  competition: "#22c55e",
  light: "#a78bfa",
} as const;

/* ─── Misc accents ───────────────────────────────────────────────────────── */

/** Amber primary accent for the urgency marker. Same as brand amber, but
 *  rendered as inline style for canvas/SVG paint contexts. */
export const PRIMARY_AMBER = "#f59e0b";

/** Muted neutral fallback for unknown phases/events. Mid-gray. */
export const MUTED_NEUTRAL = "#888";

/** Deeper neutral fallback for sparkline / dot indicators. */
export const MUTED_NEUTRAL_DARK = "#666";

/* ─── Wellness traffic-light ─────────────────────────────────────────────── */

/**
 * Three-tier indicator for wellness/readiness/throws-target visualizations.
 * Renders as inline backgroundColor on small bars where the hue is dynamic
 * (changes per row), so semantic Tailwind classes can't substitute.
 *
 * Tier thresholds (effective value 0-10):
 *   - good: >= 7
 *   - warning: >= 4
 *   - danger: < 4
 */
export const WELLNESS_TIER_COLORS = {
  good: "#5BB88A",
  warning: "#D4915A",
  danger: "#D46A6A",
} as const;

/** Return the wellness-tier hex for a normalized 0-10 value. */
export function wellnessTierColor(value: number): string {
  if (value >= 7) return WELLNESS_TIER_COLORS.good;
  if (value >= 4) return WELLNESS_TIER_COLORS.warning;
  return WELLNESS_TIER_COLORS.danger;
}

/** Return the wellness-tier hex for a 0-100 percentage. */
export function wellnessTierColorForPct(pct: number): string {
  if (pct >= 80) return WELLNESS_TIER_COLORS.good;
  if (pct >= 40) return WELLNESS_TIER_COLORS.warning;
  return WELLNESS_TIER_COLORS.danger;
}
