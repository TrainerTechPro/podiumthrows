"use client";

import { Input } from "@/components/ui/Input";
import type { DateBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function DateInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<DateBlock>) {
  return (
    <Input
      type={block.includeTime ? "datetime-local" : "date"}
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      min={block.minDate}
      max={block.maxDate}
      error={error}
      disabled={disabled}
    />
  );
}
