"use client";

import type { ScaleBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function ScaleInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<ScaleBlock>) {
  const max = block.type === "scale_1_5" ? 5 : 10;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => !disabled && onChange(n)}
              disabled={disabled}
              className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                selected
                  ? "bg-primary-500 text-white ring-2 ring-primary-500/30"
                  : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-primary-500/50"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {n}
            </button>
          );
        })}
      </div>
      {(block.lowLabel || block.highLabel) && (
        <div className="flex justify-between text-[10px] text-muted px-1">
          <span>{block.lowLabel}</span>
          <span>{block.highLabel}</span>
        </div>
      )}
      {error && (
        <p className="text-xs text-danger-500 dark:text-danger-400">{error}</p>
      )}
    </div>
  );
}
