"use client";

import { InputHTMLAttributes, useId } from "react";
import { cn } from "@/lib/utils";
import { getRpeHex } from "@/lib/design-tokens";

export interface RPESliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "min" | "max" | "value" | "onChange"> {
  value: number;
  onChange: (value: number) => void;
  showLabels?: boolean;
  showDescription?: boolean;
  className?: string;
}

const RPE_LABELS: Record<number, { short: string; desc: string }> = {
  1:  { short: "1",  desc: "Very easy" },
  2:  { short: "2",  desc: "Easy" },
  3:  { short: "3",  desc: "Moderate" },
  4:  { short: "4",  desc: "Somewhat hard" },
  5:  { short: "5",  desc: "Hard" },
  6:  { short: "6",  desc: "Hard+" },
  7:  { short: "7",  desc: "Very hard" },
  8:  { short: "8",  desc: "Very hard+" },
  9:  { short: "9",  desc: "Near maximal" },
  10: { short: "10", desc: "Maximal" },
};

/** Interpolate hex color: green (8-10) → amber (5-7) → red (1-4) */
const getRpeColor = getRpeHex;

/** Background gradient for the filled portion of the track */
function getTrackGradient(rpe: number): string {
  const color = getRpeColor(rpe);
  const pct = ((rpe - 1) / 9) * 100;
  return `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, var(--muted-bg) ${pct}%, var(--muted-bg) 100%)`;
}

export function RPESlider({
  value,
  onChange,
  showLabels = true,
  showDescription = true,
  className,
  disabled,
  ...props
}: RPESliderProps) {
  const id = useId();
  const color = getRpeColor(value);
  const label = RPE_LABELS[value] ?? RPE_LABELS[5];

  return (
    <div className={cn("w-full select-none", className)}>
      {/* Value bubble */}
      <div className="flex items-end justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="text-3xl font-bold font-heading tabular-nums transition-colors duration-200"
            style={{ color }}
          >
            {value}
          </span>
          <span className="text-base font-medium text-muted leading-none mb-0.5">/ 10</span>
        </div>
        {showDescription && (
          <span
            className="text-sm font-medium transition-colors duration-200"
            style={{ color }}
          >
            {label.desc}
          </span>
        )}
      </div>

      {/* Slider */}
      <div className="relative" style={{ "--rpe-color": color } as React.CSSProperties}>
        <input
          id={id}
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn("rpe-slider", disabled && "opacity-50 cursor-not-allowed")}
          style={{ background: getTrackGradient(value) }}
          aria-label="RPE"
          aria-valuemin={1}
          aria-valuemax={10}
          aria-valuenow={value}
          aria-valuetext={`${value} - ${label.desc}`}
          {...props}
        />
      </div>

      {/* Tick labels */}
      {showLabels && (
        <div className="flex justify-between mt-2 px-0.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => !disabled && onChange(n)}
              disabled={disabled}
              className={cn(
                "text-[10px] tabular-nums transition-all duration-150 leading-none",
                "hover:font-semibold",
                n === value
                  ? "font-bold"
                  : "font-normal text-muted"
              )}
              style={{ color: n === value ? color : undefined }}
              aria-label={`Set RPE to ${n}`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
