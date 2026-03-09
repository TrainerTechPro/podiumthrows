"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { RankingBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function RankingInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<RankingBlock>) {
  const [items, setItems] = useState<Array<{ id: string; label: string }>>(() => {
    // If value is already an ordered array of labels, reconstruct items
    if (Array.isArray(value) && value.length === block.items.length) {
      return (value as string[]).map((label) => {
        const item = block.items.find((i) => i.label === label);
        return item ?? { id: label, label };
      });
    }
    return [...block.items];
  });

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    onChange(items.map((i) => i.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Focus the item after a keyboard move
  useEffect(() => {
    if (focusIdx !== null && itemRefs.current[focusIdx]) {
      itemRefs.current[focusIdx]?.focus();
      setFocusIdx(null);
    }
  }, [focusIdx, items]);

  const moveItem = useCallback((from: number, to: number) => {
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setFocusIdx(to);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (disabled) return;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (index > 0) moveItem(index, index - 1);
        break;
      case "ArrowDown":
        e.preventDefault();
        if (index < items.length - 1) moveItem(index, index + 1);
        break;
      case "Home":
        e.preventDefault();
        if (index > 0) moveItem(index, 0);
        break;
      case "End":
        e.preventDefault();
        if (index < items.length - 1) moveItem(index, items.length - 1);
        break;
    }
  }

  const errorId = error ? `ranking-error-${block.id}` : undefined;

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted" id={`ranking-hint-${block.id}`}>
        Drag to reorder, or focus an item and use arrow keys
      </p>
      <div
        className="space-y-1"
        role="listbox"
        aria-label={block.label || "Ranking"}
        aria-describedby={`ranking-hint-${block.id}`}
      >
        {items.map((item, i) => (
          <div
            key={item.id}
            ref={(el) => { itemRefs.current[i] = el; }}
            role="option"
            aria-selected={false}
            aria-label={`${item.label}, position ${i + 1} of ${items.length}`}
            tabIndex={disabled ? -1 : 0}
            draggable={!disabled}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add("ring-2", "ring-primary-500/30");
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove("ring-2", "ring-primary-500/30");
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("ring-2", "ring-primary-500/30");
              if (dragIdx !== null && dragIdx !== i) {
                moveItem(dragIdx, i);
              }
              setDragIdx(null);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-1 ${
              disabled ? "opacity-50" : "cursor-grab active:cursor-grabbing"
            }`}
          >
            {/* Drag handle */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0" aria-hidden="true">
              <circle cx="9" cy="6" r="1" fill="currentColor" />
              <circle cx="15" cy="6" r="1" fill="currentColor" />
              <circle cx="9" cy="12" r="1" fill="currentColor" />
              <circle cx="15" cy="12" r="1" fill="currentColor" />
              <circle cx="9" cy="18" r="1" fill="currentColor" />
              <circle cx="15" cy="18" r="1" fill="currentColor" />
            </svg>

            <span className="text-xs font-bold text-muted w-5" aria-hidden="true">{i + 1}</span>
            <span className="flex-1 text-[var(--foreground)] min-w-0 truncate">{item.label}</span>

            {/* Arrow buttons */}
            <div className="flex gap-0.5 shrink-0">
              <button
                type="button"
                disabled={disabled || i === 0}
                onClick={() => moveItem(i, i - 1)}
                aria-label={`Move ${item.label} up`}
                className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30 min-w-[28px] min-h-[28px] flex items-center justify-center"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>
              <button
                type="button"
                disabled={disabled || i === items.length - 1}
                onClick={() => moveItem(i, i + 1)}
                aria-label={`Move ${item.label} down`}
                className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30 min-w-[28px] min-h-[28px] flex items-center justify-center"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-danger-500 dark:text-danger-400" role="alert">{error}</p>
      )}
    </div>
  );
}
