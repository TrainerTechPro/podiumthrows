"use client";

import { Input } from "@/components/ui/Input";
import type { NumberBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function NumberInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<NumberBlock>) {
  return (
    <Input
      type="number"
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={block.placeholder ?? "0"}
      min={block.min}
      max={block.max}
      step={block.step}
      rightAddon={block.unit ? <span>{block.unit}</span> : undefined}
      error={error}
      disabled={disabled}
    />
  );
}
