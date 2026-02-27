"use client";

import { useState } from "react";
import type { BlockType } from "@/lib/forms/types";
import {
  BLOCK_REGISTRY,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from "@/lib/forms/block-registry";

interface BlockTypeSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: BlockType) => void;
}

export function BlockTypeSelector({
  open,
  onClose,
  onSelect,
}: BlockTypeSelectorProps) {
  const [search, setSearch] = useState("");

  if (!open) return null;

  const query = search.toLowerCase();

  const grouped = CATEGORY_ORDER.map((cat) => {
    const blocks = Object.values(BLOCK_REGISTRY).filter(
      (b) =>
        b.category === cat &&
        (b.label.toLowerCase().includes(query) ||
          b.description.toLowerCase().includes(query))
    );
    return { category: cat, label: CATEGORY_LABELS[cat], blocks };
  }).filter((g) => g.blocks.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[80vh] bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--card-border)]">
          <h3 className="text-base font-bold font-heading text-[var(--foreground)]">
            Add Block
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-[var(--foreground)] transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-[var(--card-border)]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search block types..."
            autoFocus
            className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>

        {/* Block list */}
        <div className="overflow-y-auto max-h-[55vh] p-5 space-y-5">
          {grouped.map((group) => (
            <div key={group.category}>
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                {group.label}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {group.blocks.map((meta) => (
                  <button
                    key={meta.type}
                    type="button"
                    onClick={() => {
                      onSelect(meta.type);
                      onClose();
                    }}
                    className="flex items-start gap-3 p-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] hover:border-primary-500/50 hover:bg-primary-500/5 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-primary-500"
                      >
                        <path d={meta.icon} />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {meta.label}
                      </p>
                      <p className="text-[10px] text-muted leading-snug">
                        {meta.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
