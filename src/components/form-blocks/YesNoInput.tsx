"use client";

import type { YesNoBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function YesNoInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<YesNoBlock>) {
  const errorId = error ? `yn-error-${block.id}` : undefined;

  return (
    <fieldset className="space-y-2" aria-describedby={errorId}>
      {block.label && (
        <legend className="sr-only">{block.label}</legend>
      )}

      <div role="radiogroup" aria-label={block.label || "Yes or No"} className="flex gap-2">
        {(["Yes", "No"] as const).map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => !disabled && onChange(opt)}
              disabled={disabled}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                selected
                  ? opt === "Yes"
                    ? "bg-green-500/15 text-green-600 dark:text-green-400 ring-1 ring-green-500/30"
                    : "bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/30"
                  : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-primary-500/50"
              }`}
            >
              {opt}
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
