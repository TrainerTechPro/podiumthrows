"use client";

import { Input } from "@/components/ui/Input";
import type { DistanceBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function DistanceInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<DistanceBlock>) {
  return (
    <Input
      type="number"
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={block.placeholder ?? "0.00"}
      step="0.01"
      min={0}
      rightAddon={<span>{block.unit === "meters" ? "m" : "ft"}</span>}
      error={error}
      disabled={disabled}
    />
  );
}
