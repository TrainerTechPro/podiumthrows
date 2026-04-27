"use client";

import { useMemo } from "react";
import { Flame, ChevronLeft, ChevronRight } from "lucide-react";
import { NumberFlow } from "@/components/ui/NumberFlow";
import { Button } from "@/components/ui/Button";
import { InteractiveBodyMap } from "@/components/ui/InteractiveBodyMap";
import type { StepProps } from "./types";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/** Inverted coloring: low = green (good), high = red (bad) */
function sorenessColor(v: number): string {
  if (v <= 3) return "#10b981";
  if (v <= 6) return "#f59e0b";
  return "#ef4444";
}

function sorenessLabel(v: number): string {
  if (v <= 2) return "Minimal";
  if (v <= 4) return "Mild";
  if (v <= 6) return "Moderate";
  if (v <= 8) return "Significant";
  return "Severe";
}

function trackGradient(value: number, min: number, max: number): string {
  const color = sorenessColor(value);
  const pct = ((value - min) / (max - min)) * 100;
  return `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, var(--muted-bg) ${pct}%, var(--muted-bg) 100%)`;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function SorenessStep({ data, onChange, onNext, onBack }: StepProps) {
  const color = useMemo(() => sorenessColor(data.soreness), [data.soreness]);
  const label = useMemo(() => sorenessLabel(data.soreness), [data.soreness]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Progress bar ───────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted tracking-wider uppercase">
            Step
          </span>
          <span className="text-[11px] font-bold text-[var(--foreground)] tabular-nums">2/5</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--muted-bg)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
            style={{ width: "40%" }}
          />
        </div>
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
          <Flame size={20} strokeWidth={1.75} className="text-emerald-500" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-heading text-[var(--foreground)] leading-tight">
            Soreness
          </h2>
          <p className="text-[13px] text-muted leading-snug">Rate overall and tap sore areas</p>
        </div>
      </div>

      {/* ── Overall Soreness slider ────────────────────────────────────── */}
      <div className="space-y-5 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-5 py-5">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="soreness" className="text-sm font-semibold text-[var(--foreground)]">
            Overall Soreness
          </label>
          <div className="flex items-baseline gap-2.5">
            <span
              className="text-xs font-medium uppercase tracking-wider transition-colors duration-200"
              style={{ color }}
            >
              {label}
            </span>
            <NumberFlow
              value={data.soreness}
              className="text-[32px] font-extrabold font-heading leading-none tabular-nums"
              style={{ color }}
            />
          </div>
        </div>

        <div className="relative px-1 py-2">
          <input
            id="soreness"
            type="range"
            min={1}
            max={10}
            step={1}
            value={data.soreness}
            onChange={(e) => onChange({ soreness: parseInt(e.target.value) })}
            className="rpe-slider w-full"
            style={
              {
                background: trackGradient(data.soreness, 1, 10),
                "--rpe-color": color,
              } as React.CSSProperties
            }
            aria-label="Overall soreness"
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuenow={data.soreness}
            aria-valuetext={`${data.soreness} - ${label}`}
          />
        </div>

        <div className="flex justify-between text-[11px] text-muted px-1">
          <span>No soreness</span>
          <span>Extremely sore</span>
        </div>
      </div>

      {/* ── Body Map ───────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          Sore Areas <span className="text-muted font-normal text-xs">(optional)</span>
        </p>
        <InteractiveBodyMap
          value={data.sorenessArea}
          onChange={(areas) => onChange({ sorenessArea: areas })}
        />
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
