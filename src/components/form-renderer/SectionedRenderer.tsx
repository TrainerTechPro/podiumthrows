"use client";

import { useState, useCallback } from "react";
import type { FormBlock, ConditionalRule } from "@/lib/forms/types";
import { BlockRenderer } from "@/components/form-blocks/BlockRenderer";
import { NavigationControls } from "./NavigationControls";
import { resolveMergeTags } from "@/lib/forms/answer-piping";
import { INPUT_BLOCK_TYPES } from "@/lib/forms/types";

interface Section {
  id: string;
  title: string;
  subtitle?: string;
  blocks: FormBlock[];
}

interface SectionedRendererProps {
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

function buildSections(
  blocks: FormBlock[],
  visibleSet: Set<string>
): Section[] {
  const sections: Section[] = [];
  let current: Section = {
    id: "__default",
    title: "Questions",
    blocks: [],
  };

  for (const block of blocks) {
    if (!visibleSet.has(block.id)) continue;

    if (block.type === "section_header") {
      // Start a new section
      if (current.blocks.length > 0) {
        sections.push(current);
      }
      current = {
        id: block.id,
        title: block.label,
        subtitle: block.description,
        blocks: [],
      };
    } else {
      current.blocks.push(block);
    }
  }

  if (current.blocks.length > 0) {
    sections.push(current);
  }

  return sections;
}

export function SectionedRenderer({
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
}: SectionedRendererProps) {
  const visibleSet = new Set(visibleBlockIds);
  const sections = buildSections(blocks, visibleSet);
  const [sectionIdx, setSectionIdx] = useState(0);

  const currentSection = sections[sectionIdx];
  const isFirst = sectionIdx === 0;
  const isLast = sectionIdx === sections.length - 1;

  const goNext = useCallback(() => {
    if (!isLast) setSectionIdx((i) => i + 1);
  }, [isLast]);

  const goPrev = useCallback(() => {
    if (isFirst) {
      onBack();
    } else {
      setSectionIdx((i) => i - 1);
    }
  }, [isFirst, onBack]);

  if (!currentSection) return null;

  // Section navigation tabs
  const sectionNav = (
    <div className="flex gap-1 overflow-x-auto pb-2 mb-4">
      {sections.map((s, i) => (
        <button
          key={s.id}
          type="button"
          onClick={() => setSectionIdx(i)}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            i === sectionIdx
              ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30"
              : "text-muted hover:text-[var(--foreground)] hover:bg-[var(--card-bg)]"
          }`}
        >
          {i + 1}. {s.title}
        </button>
      ))}
    </div>
  );

  // Progress bar for sections
  const pct = Math.round(((sectionIdx + 1) / sections.length) * 100);

  return (
    <div className="space-y-4">
      {/* Section progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            Section {sectionIdx + 1} of {sections.length}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--card-border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-500 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {sectionNav}

      {/* Section title */}
      <div className="py-2">
        <h3 className="text-lg font-bold font-heading text-[var(--foreground)]">
          {currentSection.title}
        </h3>
        {currentSection.subtitle && (
          <p className="text-sm text-muted mt-0.5">
            {currentSection.subtitle}
          </p>
        )}
      </div>

      {/* Section blocks */}
      <div className="space-y-5">
        {currentSection.blocks.map((block) => {
          if (!INPUT_BLOCK_TYPES.includes(block.type)) return null;
          return (
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
          );
        })}
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
        nextLabel="Next Section"
      />
    </div>
  );
}
