"use client";

import { useState, useCallback, useEffect } from "react";
import type { FormBlock, ConditionalRule } from "@/lib/forms/types";
import { BlockRenderer } from "@/components/form-blocks/BlockRenderer";
import { ProgressIndicator } from "./ProgressIndicator";
import { NavigationControls } from "./NavigationControls";
import { resolveMergeTags } from "@/lib/forms/answer-piping";
import { getJumpTarget } from "@/lib/forms/conditional-engine";
import { INPUT_BLOCK_TYPES } from "@/lib/forms/types";

interface OnePerPageRendererProps {
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
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
}

export function OnePerPageRenderer({
  blocks,
  visibleBlockIds,
  answers,
  errors,
  conditionalLogic,
  onAnswer,
  onSubmit,
  onBack,
  canSubmit,
  submitting,
  disabled,
  initialIndex = 0,
  onIndexChange,
}: OnePerPageRendererProps) {
  const visibleSet = new Set(visibleBlockIds);
  const visibleBlocks = blocks.filter((b) => visibleSet.has(b.id));
  const inputBlocks = visibleBlocks.filter((b) =>
    INPUT_BLOCK_TYPES.includes(b.type)
  );

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  const currentBlock = inputBlocks[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === inputBlocks.length - 1;

  const goTo = useCallback(
    (index: number, dir: "forward" | "backward") => {
      const clamped = Math.max(0, Math.min(index, inputBlocks.length - 1));
      setDirection(dir);
      setCurrentIndex(clamped);
      onIndexChange?.(clamped);
    },
    [inputBlocks.length, onIndexChange]
  );

  const goNext = useCallback(() => {
    if (!currentBlock) return;

    // Check for conditional jump
    if (conditionalLogic) {
      const jumpTarget = getJumpTarget(
        currentBlock.id,
        conditionalLogic,
        answers
      );
      if (jumpTarget) {
        const jumpIdx = inputBlocks.findIndex((b) => b.id === jumpTarget);
        if (jumpIdx !== -1) {
          goTo(jumpIdx, "forward");
          return;
        }
      }
    }

    goTo(currentIndex + 1, "forward");
  }, [currentBlock, conditionalLogic, answers, inputBlocks, currentIndex, goTo]);

  const goPrev = useCallback(() => {
    if (isFirst) {
      onBack();
      return;
    }
    goTo(currentIndex - 1, "backward");
  }, [isFirst, onBack, currentIndex, goTo]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (isLast) {
          if (canSubmit) onSubmit();
        } else {
          goNext();
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isLast, canSubmit, onSubmit, goNext]);

  if (!currentBlock) {
    return null;
  }

  const animClass =
    direction === "forward" ? "animate-slide-in-up" : "animate-slide-in-down";

  return (
    <div className="flex flex-col min-h-[60vh] justify-between">
      <div>
        <ProgressIndicator
          mode="ONE_PER_PAGE"
          currentIndex={currentIndex}
          totalCount={inputBlocks.length}
          answeredCount={0}
          requiredCount={0}
        />

        <div
          key={currentBlock.id}
          className={`max-w-lg mx-auto py-8 ${animClass}`}
        >
          <div className="mb-2 text-xs text-muted">
            {currentIndex + 1} of {inputBlocks.length}
          </div>
          <BlockRenderer
            block={currentBlock}
            value={answers[currentBlock.id]}
            onChange={(val) => onAnswer(currentBlock.id, val)}
            error={errors[currentBlock.id]}
            disabled={disabled || submitting}
            resolvedLabel={resolveMergeTags(
              currentBlock.label,
              answers,
              blocks
            )}
            resolvedDescription={
              currentBlock.description
                ? resolveMergeTags(currentBlock.description, answers, blocks)
                : undefined
            }
          />
        </div>
      </div>

      <NavigationControls
        showPrev={true}
        showNext={!isLast}
        showSubmit={isLast}
        canSubmit={canSubmit}
        submitting={submitting}
        onPrev={goPrev}
        onNext={goNext}
        onSubmit={onSubmit}
        nextLabel="OK"
      />

      <p className="text-center text-[10px] text-muted mt-2">
        Press <kbd className="px-1 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--card-border)] text-[10px]">Enter</kbd> to continue
      </p>
    </div>
  );
}
