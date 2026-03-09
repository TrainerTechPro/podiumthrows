"use client";

import type { LikertBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function LikertInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<LikertBlock>) {
  const errorId = error ? `likert-error-${block.id}` : undefined;

  return (
    <fieldset className="space-y-2" aria-describedby={errorId}>
      {block.label && (
        <legend className="sr-only">{block.label}</legend>
      )}

      <div role="radiogroup" aria-label={block.label || "Rate"} className="flex flex-wrap gap-2">
        {block.scale.map((label) => {
          const selected = value === label;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => !disabled && onChange(label)}
              disabled={disabled}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                selected
                  ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30"
                  : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-primary-500/50"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-danger-500 dark:text-danger-400" role="alert">{error}</p>
      )}
    </fieldset>
  );
}
