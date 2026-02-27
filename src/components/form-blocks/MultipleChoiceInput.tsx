"use client";

import type { MultipleChoiceBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function MultipleChoiceInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<MultipleChoiceBlock>) {
  const current = (value as string[]) || [];
  const options = block.randomize
    ? [...block.options].sort(() => Math.random() - 0.5)
    : block.options;

  function toggle(optValue: string) {
    if (disabled) return;
    const next = current.includes(optValue)
      ? current.filter((v) => v !== optValue)
      : [...current, optValue];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const checked = current.includes(opt.value);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.value)}
            disabled={disabled}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              checked
                ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30"
                : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-primary-500/50"
            }`}
          >
            <span
              className={`w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center ${
                checked
                  ? "border-primary-500 bg-primary-500 text-white"
                  : "border-[var(--card-border)]"
              }`}
            >
              {checked && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            {opt.label}
          </button>
        );
      })}

      {block.minSelections && (
        <p className="text-[10px] text-muted">
          Select at least {block.minSelections}
          {block.maxSelections ? `, at most ${block.maxSelections}` : ""}
        </p>
      )}

      {error && (
        <p className="text-xs text-danger-500 dark:text-danger-400">{error}</p>
      )}
    </div>
  );
}
