"use client";

import { Input } from "@/components/ui/Input";
import type { ShortTextBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function ShortTextInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<ShortTextBlock>) {
  return (
    <Input
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={block.placeholder ?? "Your answer..."}
      maxLength={block.maxLength}
      error={error}
      disabled={disabled}
    />
  );
}
