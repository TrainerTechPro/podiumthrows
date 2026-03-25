// src/app/(dashboard)/athlete/_wearable-helpers.ts

// ─── Score Color Helpers ────────────────────────────────────────────────────

/** Color for recovery/readiness score text (0-100 scale) */
export function scoreColor(score: number | null): string {
  if (score === null) return "text-surface-400";
  if (score >= 67) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 34) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

/** Background for recovery/readiness hero card */
export function scoreBg(score: number | null): string {
  if (score === null) return "bg-surface-100 dark:bg-surface-800";
  if (score >= 67) return "bg-emerald-50 dark:bg-emerald-500/10";
  if (score >= 34) return "bg-amber-50 dark:bg-amber-500/10";
  return "bg-red-50 dark:bg-red-500/10";
}

/** Status label for recovery/readiness score */
export function scoreLabel(score: number | null): string {
  if (score === null) return "No data";
  if (score >= 80) return "Excellent";
  if (score >= 67) return "Good";
  if (score >= 34) return "Moderate";
  return "Low";
}

/** SpO2 color: red <95%, amber 95-96%, emerald >96% */
export function spo2Color(value: number | null): string {
  if (value === null) return "text-surface-400";
  if (value > 96) return "text-emerald-600 dark:text-emerald-400";
  if (value >= 95) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

/** Skin temp color: emerald <=0.5C, amber 0.5-1.0C, red >1.0C */
export function skinTempColor(deviation: number | null): string {
  if (deviation === null) return "text-surface-400";
  const abs = Math.abs(deviation);
  if (abs <= 0.5) return "text-emerald-600 dark:text-emerald-400";
  if (abs <= 1.0) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

// ─── Formatters ─────────────────────────────────────────────────────────────

export function formatMs(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${mins}m`;
}

export function formatSec(sec: number): string {
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Compute average of non-null values */
export function avg(arr: (number | null)[]): number | null {
  const valid = arr.filter((v): v is number => v !== null);
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

/** Trend delta: today vs average. Returns null if either is null. */
export function trendDelta(today: number | null, average: number | null): number | null {
  if (today === null || average === null) return null;
  return Math.round((today - average) * 10) / 10;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WhoopMetrics {
  recoveryScore: number | null;
  hrvMs: number | null;
  restingHR: number | null;
  spo2: number | null;
  skinTempC: number | null;
  strain: number | null;
  sleepPerformance: number | null;
  sleepDurationMs: number | null;
  sleepEfficiency: number | null;
  lightSleepMs: number | null;
  swsSleepMs: number | null;
  remSleepMs: number | null;
}

export interface OuraMetrics {
  readinessScore: number | null;
  hrvMs: number | null;
  restingHR: number | null;
  spo2: number | null;
  temperatureDeviation: number | null;
  sleepScore: number | null;
  sleepDurationSec: number | null;
  sleepEfficiency: number | null;
  lightSleepSec: number | null;
  deepSleepSec: number | null;
  remSleepSec: number | null;
  activityScore: number | null;
  steps: number | null;
}

export interface SnapshotRow {
  id: string;
  date: string;
}

export type WhoopRow = SnapshotRow & WhoopMetrics;
export type OuraRow = SnapshotRow & OuraMetrics;
