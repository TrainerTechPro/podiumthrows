"use client";

import type { LongTextBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function LongTextInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<LongTextBlock>) {
  return (
    <div className="space-y-1">
      <textarea
        className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 resize-y min-h-[80px] disabled:opacity-50"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={block.placeholder ?? "Your answer..."}
        maxLength={block.maxLength}
        rows={block.rows ?? 3}
        disabled={disabled}
      />
      {error && (
        <p className="text-xs text-danger-500 dark:text-danger-400">{error}</p>
      )}
    </div>
  );
}
