"use client";

import { IMPLEMENT_WEIGHTS } from "@/lib/forms/constants";
import type { ImplementSelectBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function ImplementSelectInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<ImplementSelectBlock>) {
  const event = block.event ?? "SHOT_PUT";
  const gender = block.gender ?? "MALE";
  const weights = IMPLEMENT_WEIGHTS[event]?.[gender] ?? [];

  const selected = block.allowMultiple
    ? ((value as number[]) ?? [])
    : value != null
    ? [value as number]
    : [];

  function toggle(weightKg: number) {
    if (disabled) return;
    if (block.allowMultiple) {
      const current = (value as number[]) ?? [];
      const next = current.includes(weightKg)
        ? current.filter((w) => w !== weightKg)
        : [...current, weightKg];
      onChange(next);
    } else {
      onChange(weightKg);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {weights.map((impl) => {
          const isSelected = selected.includes(impl.weightKg);
          return (
            <button
              key={impl.weightKg}
              type="button"
              onClick={() => toggle(impl.weightKg)}
              disabled={disabled}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isSelected
                  ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30"
                  : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-primary-500/50"
              }`}
            >
              <span className="font-bold">{impl.label}</span>
              {impl.isCompetition && (
                <span className="ml-1 text-[10px] text-primary-500">COMP</span>
              )}
            </button>
          );
        })}
      </div>
      {!block.allowMultiple && (
        <p className="text-[10px] text-muted">Select one implement</p>
      )}
      {error && (
        <p className="text-xs text-danger-500 dark:text-danger-400">{error}</p>
      )}
    </div>
  );
}
