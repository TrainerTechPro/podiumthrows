"use client";

import { RPESlider } from "@/components/ui/RPESlider";
import type { RPEBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function RPEInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<RPEBlock>) {
  return (
    <div className="space-y-1">
      <RPESlider
        value={(value as number) ?? 5}
        onChange={(v) => onChange(v)}
        showLabels={block.showLabels ?? true}
        showDescription={block.showDescription ?? true}
        disabled={disabled}
      />
      {error && (
        <p className="text-xs text-danger-500 dark:text-danger-400">{error}</p>
      )}
    </div>
  );
}
