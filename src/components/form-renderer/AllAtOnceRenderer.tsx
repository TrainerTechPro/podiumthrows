"use client";

import type { FormBlock, ConditionalRule } from "@/lib/forms/types";
import { BlockRenderer } from "@/components/form-blocks/BlockRenderer";
import { ProgressIndicator } from "./ProgressIndicator";
import { NavigationControls } from "./NavigationControls";
import { resolveMergeTags } from "@/lib/forms/answer-piping";
import { INPUT_BLOCK_TYPES } from "@/lib/forms/types";

interface AllAtOnceRendererProps {
  blocks: FormBlock[];
  visibleBlockIds: string[];
  answers: Record<string, unknown>;
  errors: Record<string, string>;
  conditionalLogic?: ConditionalRule[];
  onAnswer: (blockId: string, value: unknown) => void;
  onSubmit: () => void;
  onBack: () => void;
  canSubmit: boolean;
  submitting: boolean;
  disabled?: boolean;
}

export function AllAtOnceRenderer({
  blocks,
  visibleBlockIds,
  answers,
  errors,
  onAnswer,
  onSubmit,
  onBack,
  canSubmit,
  submitting,
  disabled,
}: AllAtOnceRendererProps) {
  const visibleSet = new Set(visibleBlockIds);
  const visibleBlocks = blocks.filter((b) => visibleSet.has(b.id));

  const inputBlocks = visibleBlocks.filter((b) =>
    INPUT_BLOCK_TYPES.includes(b.type)
  );
  const requiredCount = inputBlocks.filter((b) => b.required).length;
  const answeredCount = inputBlocks.filter((b) => {
    if (!b.required) return false;
    const val = answers[b.id];
    return val !== undefined && val !== null && val !== "";
  }).length;

  return (
    <div className="space-y-6">
      <ProgressIndicator
        mode="ALL_AT_ONCE"
        currentIndex={0}
        totalCount={inputBlocks.length}
        answeredCount={answeredCount}
        requiredCount={requiredCount}
      />

      <div className="space-y-5">
        {visibleBlocks.map((block) => (
          <div key={block.id} className="card p-4 animate-fade-in">
            <BlockRenderer
              block={block}
              value={answers[block.id]}
              onChange={(val) => onAnswer(block.id, val)}
              error={errors[block.id]}
              disabled={disabled || submitting}
              resolvedLabel={resolveMergeTags(block.label, answers, blocks)}
              resolvedDescription={
                block.description
                  ? resolveMergeTags(block.description, answers, blocks)
                  : undefined
              }
            />
          </div>
        ))}
      </div>

      <NavigationControls
        showPrev={true}
        showNext={false}
        showSubmit={true}
        canSubmit={canSubmit}
        submitting={submitting}
        onPrev={onBack}
        onNext={() => {}}
        onSubmit={onSubmit}
      />
    </div>
  );
}
