"use client";

import { Input } from "@/components/ui/Input";
import type { EmailBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function EmailInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<EmailBlock>) {
  return (
    <Input
      type="email"
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={block.placeholder ?? "email@example.com"}
      error={error}
      disabled={disabled}
    />
  );
}
