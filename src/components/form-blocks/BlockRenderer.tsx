"use client";

import type { FormBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

import { ShortTextInput } from "./ShortTextInput";
import { LongTextInput } from "./LongTextInput";
import { EmailInput } from "./EmailInput";
import { NumberInput } from "./NumberInput";
import { SliderInput } from "./SliderInput";
import { DistanceInput } from "./DistanceInput";
import { DurationInput } from "./DurationInput";
import { ScaleInput } from "./ScaleInput";
import { RPEInput } from "./RPEInput";
import { LikertInput } from "./LikertInput";
import { SingleChoiceInput } from "./SingleChoiceInput";
import { MultipleChoiceInput } from "./MultipleChoiceInput";
import { DropdownInput } from "./DropdownInput";
import { YesNoInput } from "./YesNoInput";
import { DateInput } from "./DateInput";
import { RankingInput } from "./RankingInput";
import { MatrixInput } from "./MatrixInput";
import { BodyMapInput } from "./BodyMapInput";
import { ImplementSelectInput } from "./ImplementSelectInput";
import { VideoUploadInput } from "./VideoUploadInput";
import { PhotoUploadInput } from "./PhotoUploadInput";
import { SectionHeader } from "./SectionHeader";

// Maps block type → input component
// Layout blocks (welcome_screen, thank_you_screen) are handled by the renderer, not here
const BLOCK_COMPONENTS: Record<
  string,
  React.ComponentType<BlockInputProps<never>>
> = {
  short_text: ShortTextInput as React.ComponentType<BlockInputProps<never>>,
  long_text: LongTextInput as React.ComponentType<BlockInputProps<never>>,
  email: EmailInput as React.ComponentType<BlockInputProps<never>>,
  number: NumberInput as React.ComponentType<BlockInputProps<never>>,
  slider: SliderInput as React.ComponentType<BlockInputProps<never>>,
  distance: DistanceInput as React.ComponentType<BlockInputProps<never>>,
  duration: DurationInput as React.ComponentType<BlockInputProps<never>>,
  scale_1_5: ScaleInput as React.ComponentType<BlockInputProps<never>>,
  scale_1_10: ScaleInput as React.ComponentType<BlockInputProps<never>>,
  rpe: RPEInput as React.ComponentType<BlockInputProps<never>>,
  likert: LikertInput as React.ComponentType<BlockInputProps<never>>,
  single_choice: SingleChoiceInput as React.ComponentType<BlockInputProps<never>>,
  multiple_choice: MultipleChoiceInput as React.ComponentType<BlockInputProps<never>>,
  dropdown: DropdownInput as React.ComponentType<BlockInputProps<never>>,
  yes_no: YesNoInput as React.ComponentType<BlockInputProps<never>>,
  date: DateInput as React.ComponentType<BlockInputProps<never>>,
  ranking: RankingInput as React.ComponentType<BlockInputProps<never>>,
  matrix: MatrixInput as React.ComponentType<BlockInputProps<never>>,
  body_map: BodyMapInput as React.ComponentType<BlockInputProps<never>>,
  implement_select: ImplementSelectInput as React.ComponentType<BlockInputProps<never>>,
  video_upload: VideoUploadInput as React.ComponentType<BlockInputProps<never>>,
  photo_upload: PhotoUploadInput as React.ComponentType<BlockInputProps<never>>,
  section_header: SectionHeader as React.ComponentType<BlockInputProps<never>>,
};

interface BlockRendererProps {
  block: FormBlock;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
  /** Resolved label (with piped answers substituted) */
  resolvedLabel?: string;
  /** Resolved description */
  resolvedDescription?: string;
}

export function BlockRenderer({
  block,
  value,
  onChange,
  error,
  disabled,
  resolvedLabel,
  resolvedDescription,
}: BlockRendererProps) {
  // Layout blocks that don't collect data
  if (block.type === "welcome_screen" || block.type === "thank_you_screen") {
    return null; // These are rendered by the form shell, not inline
  }

  const Component = BLOCK_COMPONENTS[block.type];
  if (!Component) {
    return (
      <div className="p-4 rounded-lg border border-danger-500/30 bg-danger-500/5 text-sm text-danger-500">
        Unknown block type: <code>{block.type}</code>
      </div>
    );
  }

  const isLayout = block.type === "section_header";
  const label = resolvedLabel ?? block.label;
  const description = resolvedDescription ?? block.description;

  return (
    <div className="space-y-2">
      {/* Label — skip for layout blocks which render their own */}
      {!isLayout && label && (
        <label className="block text-sm font-medium text-[var(--foreground)]">
          {label}
          {block.required && (
            <span className="text-danger-500 ml-0.5">*</span>
          )}
        </label>
      )}

      {/* Description */}
      {!isLayout && description && (
        <p className="text-xs text-muted -mt-1">{description}</p>
      )}

      {/* The actual input */}
      <Component
        block={block as never}
        value={value}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    </div>
  );
}
