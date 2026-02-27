// Shared props for all block input components
import type { FormBlock } from "@/lib/forms/types";

export interface BlockInputProps<T extends FormBlock = FormBlock> {
  block: T;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
}
