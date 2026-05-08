"use client";

import { useCallback, useMemo } from "react";
import { Moon, Clock, Minus, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NumberFlow } from "@/components/ui/NumberFlow";
import { Button } from "@/components/ui/Button";
import { StepHeader } from "./_step-header";
import type { StepProps } from "./types";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function qualityColor(v: number): string {
  if (v >= 8) return "#10b981";
  if (v >= 5) return "#f59e0b";
  return "#ef4444";
}

/** Format Oura sleep duration (seconds) to "Xh Ym" */
function formatSleepDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

/** Format WHOOP sleep duration (ms) to "Xh Ym" */
function formatSleepDurationMs(ms: number): string {
  return formatSleepDuration(ms / 1000);
}

/* ─── Track gradient for the slider ──────────────────────────────────────── */

function trackGradient(value: number, min: number, max: number): string {
  const color = qualityColor(value);
  const pct = ((value - min) / (max - min)) * 100;
  return `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, var(--muted-bg) ${pct}%, var(--muted-bg) 100%)`;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function SleepStep({ data, onChange, onNext, whoopData, ouraData }: StepProps) {
  const color = useMemo(() => qualityColor(data.sleepQuality), [data.sleepQuality]);

  const adjustHours = useCallback(
    (delta: number) => {
      const next = Math.round((data.sleepHours + delta) * 2) / 2;
      if (next >= 1 && next <= 14) {
        onChange({ sleepHours: next });
      }
    },
    [data.sleepHours, onChange]
  );

  /* Wearable badge content */
  const wearableBadge = useMemo(() => {
    if (ouraData?.sleepScore != null) {
      const duration =
        ouraData.sleepDurationSec != null
          ? ` \u00b7 ${formatSleepDuration(ouraData.sleepDurationSec)}`
          : "";
      return `Oura Ring \u00b7 Sleep score ${Math.round(ouraData.sleepScore)}${duration}`;
    }
    if (whoopData?.sleepPerformance != null) {
      const duration =
        whoopData.sleepDurationMs != null
          ? ` \u00b7 ${formatSleepDurationMs(whoopData.sleepDurationMs)}`
          : "";
      return `WHOOP \u00b7 Sleep ${Math.round(whoopData.sleepPerformance)}%${duration}`;
    }
    return null;
  }, [ouraData, whoopData]);

  return (
    <div className="flex flex-col gap-6">
      <StepHeader current={1} total={5} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
          <Moon size={20} strokeWidth={1.75} className="text-amber-500" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-heading text-[var(--foreground)] leading-tight">
            Sleep
          </h2>
          <p className="text-[13px] text-muted leading-snug">How did you sleep last night?</p>
        </div>
      </div>

      {/* ── Wearable badge ─────────────────────────────────────────────── */}
      {wearableBadge && (
        <div className="flex items-center gap-2 rounded-xl bg-indigo-500/[0.08] border border-indigo-500/15 px-3 py-2">
          <Clock
            size={14}
            strokeWidth={1.75}
            className="text-indigo-400 shrink-0"
            aria-hidden="true"
          />
          <span className="text-xs font-medium text-indigo-400 leading-snug">{wearableBadge}</span>
        </div>
      )}

      {/* ── Sleep Quality ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="sleep-quality" className="text-sm font-semibold text-[var(--foreground)]">
            Sleep Quality
          </label>
          <NumberFlow
            value={data.sleepQuality}
            className="text-[28px] font-extrabold font-heading leading-none"
            style={{ color }}
          />
        </div>

        <div className="relative">
          <input
            id="sleep-quality"
            type="range"
            min={1}
            max={10}
            step={1}
            value={data.sleepQuality}
            onChange={(e) => onChange({ sleepQuality: parseInt(e.target.value) })}
            className="rpe-slider w-full"
            style={
              {
                background: trackGradient(data.sleepQuality, 1, 10),
                "--rpe-color": color,
              } as React.CSSProperties
            }
            aria-label="Sleep quality"
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuenow={data.sleepQuality}
          />
        </div>

        <div className="flex justify-between text-[10px] text-muted">
          <span>Terrible</span>
          <span>Excellent</span>
        </div>
      </div>

      {/* ── Sleep Hours ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-[var(--foreground)]">Hours Slept</p>

        <div className="flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={() => adjustHours(-0.5)}
            disabled={data.sleepHours <= 1}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              "bg-[var(--card-bg)] border border-[var(--card-border)]",
              "transition-colors hover:border-primary-500/40",
              "disabled:opacity-30 disabled:cursor-not-allowed"
            )}
            aria-label="Decrease sleep hours by half"
          >
            <Minus size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>

          <div className="flex items-baseline gap-1.5 min-w-[80px] justify-center">
            <NumberFlow
              value={data.sleepHours}
              decimals={1}
              className="text-4xl font-extrabold font-heading text-[var(--foreground)] leading-none"
            />
            <span className="text-sm font-medium text-muted">hrs</span>
          </div>

          <button
            type="button"
            onClick={() => adjustHours(0.5)}
            disabled={data.sleepHours >= 14}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              "bg-[var(--card-bg)] border border-[var(--card-border)]",
              "transition-colors hover:border-primary-500/40",
              "disabled:opacity-30 disabled:cursor-not-allowed"
            )}
            aria-label="Increase sleep hours by half"
          >
            <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Spacer ─────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Next button ────────────────────────────────────────────────── */}
      <Button
        variant="primary"
        size="lg"
        className="w-full rounded-xl min-h-[48px] text-sm font-bold text-black"
        onClick={onNext}
        rightIcon={<ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />}
      >
        Next
      </Button>
    </div>
  );
}
