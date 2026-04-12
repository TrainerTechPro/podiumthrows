import { useState, useEffect } from "react";
import type { BlockData } from "./_types";

/* ─── Block config parsers ───────────────────────────────────────────── */

export function parseConfig(config: string): Record<string, unknown> {
  try {
    return JSON.parse(config);
  } catch {
    return {};
  }
}

export function getThrowCount(cfg: Record<string, unknown>): number {
  return (cfg.throwCount as number) || 10;
}

export function getImplement(cfg: Record<string, unknown>): string {
  return (cfg.implement as string) || "";
}

export function getImplementKg(cfg: Record<string, unknown>): number {
  // start-live stores implementWeightKg as a numeric field
  const w = cfg.implementWeightKg as number;
  if (w && w > 0) return w;
  // Fallback: parse from implement string (e.g. "7.26kg")
  const str = getImplement(cfg);
  const parsed = parseFloat(str.replace(/[^0-9.]/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

export function getRestSeconds(cfg: Record<string, unknown>): number {
  return (cfg.restSeconds as number) || 0;
}

/* ─── Classification color system ───────────────────────────────────── */

export const CLASSIFICATION_ACCENT: Record<string, string> = {
  CE: "#FFC800", SDE: "#FF8800", SPE: "#00FF88", GPE: "#4488FF",
  STRENGTH: "#4488FF", WARMUP: "#FF8800", COOLDOWN: "#00BBFF",
};

export function getBlockAccent(block: BlockData): string {
  const cfg = parseConfig(block.config);
  const classification = cfg.classification as string;
  if (classification && CLASSIFICATION_ACCENT[classification]) {
    return CLASSIFICATION_ACCENT[classification];
  }
  return CLASSIFICATION_ACCENT[block.blockType] ?? "#FFC800";
}

export function getBlockLabel(block: BlockData): string {
  const cfg = parseConfig(block.config);
  const name = (cfg.exerciseName as string) || (cfg.drillName as string) || "";
  const impl = getImplement(cfg);
  const classification = (cfg.classification as string) || "";
  return [classification, impl ? impl : "", name].filter(Boolean).join(" · ");
}

export function getExerciseName(block: BlockData): string {
  const cfg = parseConfig(block.config);
  return (cfg.exerciseName as string) || (cfg.drillName as string) || block.blockType;
}

/* ─── Elapsed Timer Hook ─────────────────────────────────────────────── */

export function useElapsedTime(startedAt: string | null): number {
  const [elapsed, setElapsed] = useState(() => {
    if (!startedAt) return 0;
    return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (startedAt) {
        setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
      } else {
        setElapsed((e) => e + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return elapsed;
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ─── Self-Feeling Options ───────────────────────────────────────────── */

export const FEELING_OPTIONS = [
  { value: "GREAT", label: "Great", emoji: "💪" },
  { value: "GOOD", label: "Good", emoji: "👍" },
  { value: "AVERAGE", label: "Average", emoji: "😐" },
  { value: "POOR", label: "Poor", emoji: "😓" },
  { value: "VERY_POOR", label: "Very Poor", emoji: "🤕" },
] as const;

/* ─── Chamfer Clip-Path Constants ─────────────────────────────────────── */

export const CHAMFER =
  "polygon(0 0,calc(100% - 3px) 0,100% 3px,100% 100%,3px 100%,0 calc(100% - 3px))";

export const CHAMFER_LG =
  "polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))";
