"use client";

import { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import type { NavSection, NavItem } from "./Sidebar";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface FlatItem {
  label: string;
  href: string;
  icon: ReactNode;
  group?: string;
}

export interface CommandPaletteProps {
  sections: NavSection[];
}

/* ─── Flatten nav sections ───────────────────────────────────────────────── */

function flattenSections(sections: NavSection[]): FlatItem[] {
  const items: FlatItem[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (item.children && item.children.length > 0) {
        for (const child of item.children) {
          items.push({
            label: child.label,
            href: child.href,
            icon: child.icon,
            group: item.label,
          });
        }
      } else {
        items.push({
          label: item.label,
          href: item.href,
          icon: item.icon,
          group: section.title,
        });
      }
    }
  }
  return items;
}

/* ─── Fuzzy match ────────────────────────────────────────────────────────── */

function matches(query: string, item: FlatItem): boolean {
  const q = query.toLowerCase();
  return (
    item.label.toLowerCase().includes(q) ||
    item.href.toLowerCase().includes(q) ||
    (item.group?.toLowerCase().includes(q) ?? false)
  );
}

/* ─── CommandPalette ─────────────────────────────────────────────────────── */

export function CommandPalette({ sections }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const allItems = flattenSections(sections);
  const filtered = query.trim()
    ? allItems.filter((item) => matches(query, item))
    : allItems;

  /* ── Global keyboard shortcut (Cmd+K / Ctrl+K) ──────────────────────── */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  /* ── Reset state on open ────────────────────────────────────────────── */
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  /* ── Lock body scroll ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  /* ── Reset active index when results change ─────────────────────────── */
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  /* ── Scroll active item into view ───────────────────────────────────── */
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.children[activeIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const close = useCallback(() => setOpen(false), []);

  const navigate = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  /* ── Keyboard navigation inside palette ─────────────────────────────── */
  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[activeIndex]) navigate(filtered[activeIndex].href);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) close();
  }

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[6px] animate-fade-in"
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-2xl animate-spring-up overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-[var(--card-border)]">
          <Search
            size={18}
            strokeWidth={2}
            className="shrink-0 text-surface-400"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages..."
            className="flex-1 bg-transparent py-3.5 text-sm text-[var(--foreground)] placeholder:text-surface-400 outline-none font-heading"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-surface-400 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto custom-scrollbar py-2"
          role="listbox"
        >
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-sm text-center text-surface-400">
              No results found
            </p>
          )}
          {filtered.map((item, i) => (
            <button
              key={item.href}
              type="button"
              role="option"
              aria-selected={i === activeIndex}
              onClick={() => navigate(item.href)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
                i === activeIndex
                  ? "bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300"
                  : "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 shrink-0",
                  i === activeIndex
                    ? "text-primary-600 dark:text-primary-400"
                    : "text-surface-400 dark:text-surface-500"
                )}
              >
                {item.icon}
              </span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.group && (
                <span className="text-xs text-surface-400 dark:text-surface-500 truncate max-w-[120px]">
                  {item.group}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--card-border)] text-[10px] text-surface-400">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded font-mono bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">&uarr;&darr;</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded font-mono bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">&crarr;</kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded font-mono bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
