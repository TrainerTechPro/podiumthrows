"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    onChange(items.map((i) => i.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function moveItem(from: number, to: number) {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted">Drag to reorder or use arrows</p>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div
            key={item.id}
            draggable={!disabled}
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
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm transition-all ${
              disabled ? "opacity-50" : "cursor-grab active:cursor-grabbing"
            }`}
          >
            {/* Drag handle */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
              <circle cx="9" cy="6" r="1" fill="currentColor" />
              <circle cx="15" cy="6" r="1" fill="currentColor" />
              <circle cx="9" cy="12" r="1" fill="currentColor" />
              <circle cx="15" cy="12" r="1" fill="currentColor" />
              <circle cx="9" cy="18" r="1" fill="currentColor" />
              <circle cx="15" cy="18" r="1" fill="currentColor" />
            </svg>

            <span className="text-xs font-bold text-muted w-5">{i + 1}</span>
            <span className="flex-1 text-[var(--foreground)]">{item.label}</span>

            {/* Arrow buttons */}
            <div className="flex gap-0.5">
              <button
                type="button"
                disabled={disabled || i === 0}
                onClick={() => moveItem(i, i - 1)}
                className="p-0.5 rounded hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>
              <button
                type="button"
                disabled={disabled || i === items.length - 1}
                onClick={() => moveItem(i, i + 1)}
                className="p-0.5 rounded hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && (
        <p className="text-xs text-danger-500 dark:text-danger-400">{error}</p>
      )}
    </div>
  );
}
