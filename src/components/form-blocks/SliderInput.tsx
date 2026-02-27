"use client";

import type { SliderBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function SliderInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<SliderBlock>) {
  const numVal = (value as number) ?? block.min;
  const pct = ((numVal - block.min) / (block.max - block.min)) * 100;

  return (
    <div className="space-y-2">
      {block.showValue !== false && (
        <div className="text-2xl font-bold font-heading text-primary-500 tabular-nums">
          {numVal}
        </div>
      )}

      <input
        type="range"
        min={block.min}
        max={block.max}
        step={block.step}
        value={numVal}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-2 rounded-full appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(to right, var(--primary-500) 0%, var(--primary-500) ${pct}%, var(--muted-bg) ${pct}%, var(--muted-bg) 100%)`,
        }}
      />

      {(block.minLabel || block.maxLabel) && (
        <div className="flex justify-between text-[10px] text-muted">
          <span>{block.minLabel ?? block.min}</span>
          <span>{block.maxLabel ?? block.max}</span>
        </div>
      )}

      {error && (
        <p className="text-xs text-danger-500 dark:text-danger-400">{error}</p>
      )}
    </div>
  );
}
