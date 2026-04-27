"use client";

import { useMemo } from "react";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { NumberFlow } from "@/components/ui/NumberFlow";
import { Button } from "@/components/ui/Button";
import type { StepProps } from "./types";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function levelColor(v: number): string {
  if (v >= 8) return "#10b981";
  if (v >= 5) return "#f59e0b";
  return "#ef4444";
}

function trackGradient(value: number, min: number, max: number): string {
  const color = levelColor(value);
  const pct = ((value - min) / (max - min)) * 100;
  return `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, var(--muted-bg) ${pct}%, var(--muted-bg) 100%)`;
}

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface StressEnergyStepProps extends StepProps {
  /** Average of yesterday's stress + energy for comparison badge */
  previousScore?: number;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function StressEnergyStep({
  data,
  onChange,
  onNext,
  onBack,
  previousScore,
}: StressEnergyStepProps) {
  const stressColor = useMemo(() => levelColor(data.stressLevel), [data.stressLevel]);
  const energyColor = useMemo(() => levelColor(data.energyMood), [data.energyMood]);

  /* Comparison badge */
  const comparisonText = useMemo(() => {
    if (previousScore == null) return null;
    const currentAvg = (data.stressLevel + data.energyMood) / 2;
    const diff = currentAvg - previousScore;
    const sign = diff >= 0 ? "+" : "";
    return `Compared to yesterday: ${sign}${diff.toFixed(1)} avg`;
  }, [data.stressLevel, data.energyMood, previousScore]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Progress bar ───────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted tracking-wider uppercase">
            Step
          </span>
          <span className="text-[11px] font-bold text-[var(--foreground)] tabular-nums">3/5</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--muted-bg)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
            style={{ width: "60%" }}
          />
        </div>
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
          <Sparkles size={20} strokeWidth={1.75} className="text-yellow-500" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-heading text-[var(--foreground)] leading-tight">
            Stress &amp; Energy
          </h2>
          <p className="text-[13px] text-muted leading-snug">How are you feeling today?</p>
        </div>
      </div>

      {/* ── Comparison badge (optional) ──────────────────────────────── */}
      {comparisonText && (
        <div className="rounded-xl bg-surface-50 dark:bg-surface-900 border border-[var(--card-border)] px-3 py-2">
          <span className="text-xs font-medium text-muted">{comparisonText}</span>
        </div>
      )}

      {/* ── Stress Level slider ──────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label
              htmlFor="stress-level"
              className="text-sm font-semibold text-[var(--foreground)]"
            >
              Stress Level
            </label>
            <p className="text-[10px] text-muted mt-0.5">
              1 = overwhelmed &middot; 10 = totally relaxed
            </p>
          </div>
          <NumberFlow
            value={data.stressLevel}
            className="text-[28px] font-extrabold font-heading leading-none"
            style={{ color: stressColor }}
          />
        </div>

        <div className="relative">
          <input
            id="stress-level"
            type="range"
            min={1}
            max={10}
            step={1}
            value={data.stressLevel}
            onChange={(e) => onChange({ stressLevel: parseInt(e.target.value) })}
            className="rpe-slider w-full"
            style={
              {
                background: trackGradient(data.stressLevel, 1, 10),
                "--rpe-color": stressColor,
              } as React.CSSProperties
            }
            aria-label="Stress level"
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuenow={data.stressLevel}
          />
        </div>

        <div className="flex justify-between text-[10px] text-muted">
          <span>Overwhelmed</span>
          <span>Totally relaxed</span>
        </div>
      </div>

      {/* ── Energy / Mood slider ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label htmlFor="energy-mood" className="text-sm font-semibold text-[var(--foreground)]">
              Energy / Mood
            </label>
            <p className="text-[10px] text-muted mt-0.5">1 = exhausted &middot; 10 = fired up</p>
          </div>
          <NumberFlow
            value={data.energyMood}
            className="text-[28px] font-extrabold font-heading leading-none"
            style={{ color: energyColor }}
          />
        </div>

        <div className="relative">
          <input
            id="energy-mood"
            type="range"
            min={1}
            max={10}
            step={1}
            value={data.energyMood}
            onChange={(e) => onChange({ energyMood: parseInt(e.target.value) })}
            className="rpe-slider w-full"
            style={
              {
                background: trackGradient(data.energyMood, 1, 10),
                "--rpe-color": energyColor,
              } as React.CSSProperties
            }
            aria-label="Energy and mood"
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuenow={data.energyMood}
          />
        </div>

        <div className="flex justify-between text-[10px] text-muted">
          <span>Exhausted</span>
          <span>Fired up</span>
        </div>
      </div>

      {/* ── Spacer ─────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="lg"
          className="min-h-[48px] px-4"
          onClick={onBack}
          leftIcon={<ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />}
        >
          Back
        </Button>

        <Button
          variant="primary"
          size="lg"
          className="flex-1 rounded-xl min-h-[48px] text-sm font-bold text-black"
          onClick={onNext}
          rightIcon={<ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
