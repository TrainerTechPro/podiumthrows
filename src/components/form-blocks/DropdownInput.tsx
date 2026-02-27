"use client";

import { useState, useRef, useEffect } from "react";
import type { DropdownBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function DropdownInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<DropdownBlock>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = block.searchable && search
    ? block.options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )
    : block.options;

  const selectedLabel = block.options.find((o) => o.value === value)?.label;

  return (
    <div className="space-y-1" ref={ref}>
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className={`w-full text-left px-3 py-2 rounded-xl text-sm border transition-colors flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed ${
            open
              ? "border-primary-500 ring-2 ring-primary-500/30"
              : "border-[var(--card-border)]"
          } bg-[var(--card-bg)] text-[var(--foreground)]`}
        >
          <span className={selectedLabel ? "" : "text-muted"}>
            {selectedLabel ?? "Select..."}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {open && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-lg max-h-60 overflow-auto">
            {block.searchable && (
              <div className="p-2 border-b border-[var(--card-border)]">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full px-2 py-1 rounded-lg text-sm border border-[var(--card-border)] bg-transparent text-[var(--foreground)] placeholder:text-muted focus:outline-none"
                  autoFocus
                />
              </div>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-surface-100 dark:hover:bg-surface-800 ${
                  value === opt.value
                    ? "text-primary-600 dark:text-primary-400 font-medium"
                    : "text-[var(--foreground)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted">No options found</div>
            )}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-danger-500 dark:text-danger-400">{error}</p>
      )}
    </div>
  );
}
