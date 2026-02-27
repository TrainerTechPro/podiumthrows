"use client";

import type { FormBlock } from "@/lib/forms/types";
import { BLOCK_REGISTRY } from "@/lib/forms/block-registry";

interface BlockListItemProps {
  block: FormBlock;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  /** HTML5 drag handlers */
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragOver?: boolean;
}

export function BlockListItem({
  block,
  index,
  isSelected,
  onSelect,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver,
}: BlockListItemProps) {
  const meta = BLOCK_REGISTRY[block.type];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? "bg-primary-500/10 border border-primary-500/30"
          : "border border-transparent hover:bg-[var(--card-bg)] hover:border-[var(--card-border)]"
      } ${isDragOver ? "border-t-2 border-t-primary-500" : ""}`}
    >
      {/* Drag handle */}
      <div className="cursor-grab active:cursor-grabbing text-muted shrink-0">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <circle cx="8" cy="6" r="2" />
          <circle cx="16" cy="6" r="2" />
          <circle cx="8" cy="12" r="2" />
          <circle cx="16" cy="12" r="2" />
          <circle cx="8" cy="18" r="2" />
          <circle cx="16" cy="18" r="2" />
        </svg>
      </div>

      {/* Icon + label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted shrink-0"
          >
            <path d={meta?.icon ?? ""} />
          </svg>
          <span className="text-xs font-medium text-[var(--foreground)] truncate">
            {block.label || meta?.label || block.type}
          </span>
        </div>
        <span className="text-[10px] text-muted ml-5">
          {meta?.label}
          {block.required && " *"}
        </span>
      </div>

      {/* Actions (visible on hover) */}
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          disabled={isFirst}
          className="p-1 text-muted hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
          title="Move up"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          disabled={isLast}
          className="p-1 text-muted hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
          title="Move down"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="p-1 text-muted hover:text-[var(--foreground)] transition-colors"
          title="Duplicate"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 text-muted hover:text-red-500 transition-colors"
          title="Delete"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      </div>

      {/* Index badge */}
      <span className="text-[10px] text-muted shrink-0 w-4 text-center">
        {index + 1}
      </span>
    </div>
  );
}
