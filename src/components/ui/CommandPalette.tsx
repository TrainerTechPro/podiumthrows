"use client";

import { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Search, User, Calendar, ListChecks, Trophy, Clock, X } from "lucide-react";
import type { NavSection } from "./Sidebar";
import type { SearchResultItem } from "@/app/api/search/route";
import { logger } from "@/lib/logger";

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

/* ─── Open trigger (call from any component) ─────────────────────────────── */

const OPEN_EVENT = "podium:open-command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const RECENT_KEY = "podium-search-recent";
const MAX_RECENT = 5;

const CATEGORY_META: Record<string, { label: string; icon: ReactNode }> = {
  athlete: { label: "Athletes", icon: <User size={15} strokeWidth={1.75} /> },
  session: { label: "Sessions", icon: <Calendar size={15} strokeWidth={1.75} /> },
  program: { label: "Programs", icon: <ListChecks size={15} strokeWidth={1.75} /> },
  pr: { label: "Personal Records", icon: <Trophy size={15} strokeWidth={1.75} /> },
};

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

/* ─── Recent searches (localStorage) ─────────────────────────────────────── */

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  try {
    const recent = getRecentSearches().filter((r) => r !== query);
    recent.unshift(query);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch (err) {
    // localStorage unavailable
    logger.debug("localStorage unavailable", {
      context: "src/components/ui/CommandPalette.tsx",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }
}

/* ─── Debounce hook ──────────────────────────────────────────────────────── */

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ─── Unified result item type ───────────────────────────────────────────── */

type UnifiedItem = {
  key: string;
  label: string;
  subtitle?: string;
  href: string;
  icon: ReactNode;
  group: string;
};

/* ─── CommandPalette ─────────────────────────────────────────────────────── */

export function CommandPalette({ sections }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [dataResults, setDataResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  const allItems = flattenSections(sections);
  const debouncedQuery = useDebouncedValue(query, 300);

  // Page results (client-side filter)
  const filteredPages: UnifiedItem[] = query.trim()
    ? allItems
        .filter((item) => matches(query, item))
        .slice(0, 5)
        .map((item) => ({
          key: `page:${item.href}`,
          label: item.label,
          href: item.href,
          icon: item.icon,
          group: "Pages",
        }))
    : [];

  // Data results (from API)
  const dataItems: UnifiedItem[] = dataResults.map((r) => ({
    key: `data:${r.category}:${r.id}`,
    label: r.title,
    subtitle: r.subtitle,
    href: r.href,
    icon: CATEGORY_META[r.category]?.icon ?? <Search size={15} strokeWidth={1.75} />,
    group: CATEGORY_META[r.category]?.label ?? r.category,
  }));

  // Combine all results
  const allResults: UnifiedItem[] = [...filteredPages, ...dataItems];

  // Group results for rendering
  const grouped = new Map<string, UnifiedItem[]>();
  for (const item of allResults) {
    if (!grouped.has(item.group)) grouped.set(item.group, []);
    grouped.get(item.group)!.push(item);
  }

  const flatResults = allResults; // for keyboard navigation

  /* ── Fetch data results on debounced query ─────────────────────────── */
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setDataResults([]);
      setSearching(false);
      return;
    }

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearching(true);

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted) {
          setDataResults(data.results ?? []);
          setSearching(false);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setDataResults([]);
          setSearching(false);
        }
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  /* ── Global keyboard shortcut (Cmd+K / Ctrl+K) + custom event ────────── */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onCustomOpen() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onCustomOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onCustomOpen);
    };
  }, []);

  /* ── Reset state on open ────────────────────────────────────────────── */
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setDataResults([]);
      setRecentSearches(getRecentSearches());
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  /* ── Lock body scroll ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* ── Reset active index when results change ─────────────────────────── */
  useEffect(() => {
    setActiveIndex(0);
  }, [query, dataResults]);

  /* ── Scroll active item into view ───────────────────────────────────── */
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = list.querySelectorAll("[role='option']");
    const active = items[activeIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const close = useCallback(() => setOpen(false), []);

  const navigate = useCallback(
    (href: string) => {
      if (query.trim().length >= 2) addRecentSearch(query.trim());
      close();
      router.push(href);
    },
    [close, router, query]
  );

  /* ── Keyboard navigation inside palette ─────────────────────────────── */
  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % Math.max(flatResults.length, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex(
          (i) => (i - 1 + Math.max(flatResults.length, 1)) % Math.max(flatResults.length, 1)
        );
        break;
      case "Enter":
        e.preventDefault();
        if (flatResults[activeIndex]) navigate(flatResults[activeIndex].href);
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

  const hasQuery = query.trim().length > 0;
  const noResults = hasQuery && flatResults.length === 0 && !searching;

  let flatIndex = 0;

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 animate-fade-in" aria-hidden="true" />

      {/* Panel — overlay content MUST use --surface-overlay per CLAUDE.md
          §Overlay Surfaces. --card-bg is for inline cards in a known-opaque
          parent; floating/portaled content needs the dedicated raised token
          so it stays readable regardless of what a future token change does. */}
      <div
        className="relative w-full max-w-lg bg-[var(--surface-overlay)] border border-[var(--card-border)] rounded-2xl shadow-2xl animate-spring-up overflow-hidden"
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
            placeholder="Search athletes, sessions, programs..."
            className="flex-1 bg-transparent py-3.5 text-sm text-[var(--foreground)] placeholder:text-surface-400 outline-none font-heading"
            autoComplete="off"
            spellCheck={false}
          />
          {searching && (
            <div className="w-4 h-4 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-surface-400 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
            ESC
          </kbd>
          <button
            type="button"
            onClick={close}
            className="sm:hidden -mr-1 p-1.5 rounded-lg text-surface-400 hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Close search"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto custom-scrollbar py-2"
          role="listbox"
        >
          {/* Recent searches (when no query) */}
          {!hasQuery && recentSearches.length > 0 && (
            <>
              <div className="px-4 py-1.5 text-[10px] font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={12} strokeWidth={1.75} aria-hidden="true" />
                Recent
              </div>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setQuery(term)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 text-left transition-colors"
                >
                  <Search
                    size={15}
                    strokeWidth={1.75}
                    className="text-surface-400 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="truncate">{term}</span>
                </button>
              ))}
            </>
          )}

          {/* No results */}
          {noResults && (
            <p className="px-4 py-6 text-sm text-center text-surface-400">
              No results for &ldquo;{query}&rdquo; — try a different search term
            </p>
          )}

          {/* Grouped results */}
          {Array.from(grouped.entries()).map(([group, items]) => (
            <div key={group}>
              <div className="px-4 py-1.5 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
                {group}
              </div>
              {items.map((item) => {
                const idx = flatIndex++;
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="option"
                    aria-selected={idx === activeIndex}
                    onClick={() => navigate(item.href)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
                      idx === activeIndex
                        ? "bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300"
                        : "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                    )}
                  >
                    <span
                      className={cn(
                        "w-5 h-5 shrink-0 flex items-center justify-center",
                        idx === activeIndex
                          ? "text-primary-600 dark:text-primary-400"
                          : "text-surface-400 dark:text-surface-500"
                      )}
                    >
                      {item.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="truncate block">{item.label}</span>
                      {item.subtitle && (
                        <span className="text-xs text-surface-400 dark:text-surface-500 truncate block">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--card-border)] text-[10px] text-surface-400">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded font-mono bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
              &uarr;&darr;
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded font-mono bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
              &crarr;
            </kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded font-mono bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
              esc
            </kbd>
            close
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
