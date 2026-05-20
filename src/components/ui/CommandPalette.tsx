"use client";

import { useState, useEffect, useRef, useCallback, useMemo, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Search,
  User,
  Calendar,
  ListChecks,
  Trophy,
  Clock,
  X,
  Dumbbell,
  Activity,
  Video,
  StickyNote,
  FileText,
  ArrowRight,
} from "lucide-react";
import type { NavSection } from "./Sidebar";
import type {
  SearchResultItem,
  SearchResponse,
  SearchCategory,
  ContentHit,
  ContentSearchResponse,
} from "@/lib/search/types";
import { rankResults } from "@/lib/search/rank";
import { logger } from "@/lib/logger";

/* ─── Open trigger (call from any component) ─────────────────────────────── */

const OPEN_EVENT = "podium:open-command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface CommandPaletteProps {
  sections: NavSection[];
}

interface FlatNav {
  label: string;
  href: string;
  icon: ReactNode;
  group?: string;
}

type GroupKey = "page" | "content" | SearchCategory;

interface UnifiedItem {
  key: string;
  label: string;
  subtitle?: string;
  /** Structured snippet segments — only set on content rows. */
  snippet?: import("@/lib/search/types").SnippetSegment[];
  href: string;
  icon: ReactNode;
  group: GroupKey;
  /** Lower = better. Used to sort within a group. */
  rank: number;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const RECENT_KEY = "podium-search-recent";
const MAX_RECENT = 8;
const PER_GROUP_DISPLAY = 5;
const CONTENT_INLINE_DISPLAY = 3;
const DEBOUNCE_MS = 150;

const ICON_PROPS = { size: 15, strokeWidth: 1.75, "aria-hidden": true } as const;

const GROUP_META: Record<
  GroupKey,
  { label: string; icon: ReactNode; showMoreHref?: string; order: number }
> = {
  page: { label: "Pages", icon: <ListChecks {...ICON_PROPS} />, order: 0 },
  content: {
    label: "In your content",
    icon: <FileText {...ICON_PROPS} />,
    order: 9,
  },
  athlete: {
    label: "Athletes",
    icon: <User {...ICON_PROPS} />,
    showMoreHref: "/coach/athletes",
    order: 1,
  },
  session: {
    label: "Sessions",
    icon: <Calendar {...ICON_PROPS} />,
    showMoreHref: "/coach/calendar",
    order: 2,
  },
  program: {
    label: "Plans",
    icon: <ListChecks {...ICON_PROPS} />,
    showMoreHref: "/coach/library?view=plans",
    order: 3,
  },
  drill: {
    label: "Drills",
    icon: <Activity {...ICON_PROPS} />,
    showMoreHref: "/coach/library?view=drills",
    order: 4,
  },
  exercise: {
    label: "Exercises",
    icon: <Dumbbell {...ICON_PROPS} />,
    showMoreHref: "/coach/library?view=exercises",
    order: 5,
  },
  video: {
    label: "Video Analyses",
    icon: <Video {...ICON_PROPS} />,
    showMoreHref: "/coach/video-analysis",
    order: 6,
  },
  note: {
    label: "Notes",
    icon: <StickyNote {...ICON_PROPS} />,
    order: 7,
  },
  pr: {
    label: "Personal Records",
    icon: <Trophy {...ICON_PROPS} />,
    order: 8,
  },
};

type FilterKey = "all" | SearchCategory;

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "athlete", label: "Athletes" },
  { key: "session", label: "Sessions" },
  { key: "program", label: "Plans" },
  { key: "drill", label: "Drills" },
  { key: "exercise", label: "Exercises" },
  { key: "video", label: "Videos" },
  { key: "note", label: "Notes" },
  { key: "pr", label: "PRs" },
];

/* ─── Recent searches (localStorage, capped) ─────────────────────────────── */

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, MAX_RECENT) : [];
  } catch (err) {
    logger.debug("recent search read failed", {
      context: "ui/CommandPalette",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
    return [];
  }
}

function addRecentSearch(query: string) {
  try {
    const recent = getRecentSearches().filter((r) => r.toLowerCase() !== query.toLowerCase());
    recent.unshift(query);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch (err) {
    logger.debug("recent search write failed", {
      context: "ui/CommandPalette",
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

/* ─── Flatten nav sections into a flat searchable list ───────────────────── */

function flattenSections(sections: NavSection[]): FlatNav[] {
  const items: FlatNav[] = [];
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

/* ─── CommandPalette ─────────────────────────────────────────────────────── */

export function CommandPalette({ sections }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const [dataResults, setDataResults] = useState<SearchResultItem[]>([]);
  const [hasMore, setHasMore] = useState<Partial<Record<SearchCategory, boolean>>>({});
  const [contentHits, setContentHits] = useState<ContentHit[]>([]);
  const [contentHasMore, setContentHasMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const contentAbortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  const allNavItems = useMemo(() => flattenSections(sections), [sections]);
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

  /* ── Server fetch on debounced query / filter change ──────────────────── */
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      setDataResults([]);
      setHasMore({});
      setSearching(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);

    const params = new URLSearchParams({ q: debouncedQuery });
    if (filter !== "all") params.set("category", filter);

    fetch(`/api/search?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: SearchResponse) => {
        if (controller.signal.aborted) return;
        setDataResults(data.results ?? []);
        setHasMore(data.hasMore ?? {});
        setSearching(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          logger.warn("command palette search failed", {
            context: "ui/CommandPalette",
            metadata: { reason: err instanceof Error ? err.message : "unknown" },
          });
          setDataResults([]);
          setHasMore({});
          setSearching(false);
        }
      });

    return () => controller.abort();
  }, [debouncedQuery, filter]);

  /* ── Parallel content search (free-text grep across coach prose) ──────
     Only runs when the filter is "all" — when the coach narrows to a
     specific entity type they don't want noisy snippets at the bottom.
     ─────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (filter !== "all" || !debouncedQuery || debouncedQuery.trim().length < 2) {
      setContentHits([]);
      setContentHasMore(false);
      return;
    }

    contentAbortRef.current?.abort();
    const controller = new AbortController();
    contentAbortRef.current = controller;

    fetch(`/api/search/content?q=${encodeURIComponent(debouncedQuery)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: ContentSearchResponse) => {
        if (controller.signal.aborted) return;
        setContentHits(data.hits ?? []);
        setContentHasMore(Object.values(data.hasMore ?? {}).some(Boolean));
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          logger.warn("command palette content search failed", {
            context: "ui/CommandPalette",
            metadata: { reason: err instanceof Error ? err.message : "unknown" },
          });
          setContentHits([]);
          setContentHasMore(false);
        }
      });

    return () => controller.abort();
  }, [debouncedQuery, filter]);

  /* ── Open / close keyboard shortcut + custom event ────────────────────── */
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

  /* ── Reset state when opening ─────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setFilter("all");
    setActiveIndex(0);
    setDataResults([]);
    setHasMore({});
    setContentHits([]);
    setContentHasMore(false);
    setRecentSearches(getRecentSearches());
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  /* ── Lock body scroll while open ──────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* ── Compute the flat result list and groups ──────────────────────────── */
  const grouped = useMemo<Map<GroupKey, UnifiedItem[]>>(() => {
    const map = new Map<GroupKey, UnifiedItem[]>();
    const trimmed = query.trim();
    if (!trimmed) return map;

    // Pages — only when the filter is "all" (nav routes are not a SearchCategory).
    if (filter === "all") {
      const ranked = rankResults(allNavItems, trimmed, (it) => [
        it.label,
        ...(it.group ? [it.group] : []),
      ]);
      const pageItems: UnifiedItem[] = ranked.slice(0, PER_GROUP_DISPLAY).map((r) => ({
        key: `page:${r.item.href}`,
        label: r.item.label,
        href: r.item.href,
        icon: r.item.icon,
        group: "page",
        rank: r.score,
      }));
      if (pageItems.length > 0) map.set("page", pageItems);
    }

    // Server-side categories — re-rank the candidate set per group.
    const byCategory = new Map<SearchCategory, SearchResultItem[]>();
    for (const r of dataResults) {
      if (!byCategory.has(r.category)) byCategory.set(r.category, []);
      byCategory.get(r.category)!.push(r);
    }

    for (const [cat, rows] of byCategory) {
      const ranked = rankResults(rows, trimmed, (r) => [r.title, r.subtitle ?? ""]);
      const items: UnifiedItem[] = ranked.slice(0, PER_GROUP_DISPLAY).map((r) => ({
        key: `${cat}:${r.item.id}`,
        label: r.item.title,
        subtitle: r.item.subtitle,
        href: r.item.href,
        icon: GROUP_META[cat].icon,
        group: cat,
        rank: r.score,
      }));
      if (items.length > 0) map.set(cat, items);
    }

    // Content snippets — only when the filter is "all" so a scoped search
    // stays focused on entity rows. Top N inline; "See all" footer routes
    // to the full results page.
    if (filter === "all" && contentHits.length > 0) {
      const items: UnifiedItem[] = contentHits.slice(0, CONTENT_INLINE_DISPLAY).map((h) => ({
        key: `content:${h.kind}:${h.id}`,
        label: h.title,
        subtitle: h.parentLabel,
        snippet: h.snippet,
        href: h.href,
        icon: GROUP_META.content.icon,
        group: "content",
        // Negate so higher backend scores come first within the group.
        rank: -h.score,
      }));
      if (items.length > 0) map.set("content", items);
    }

    // Sort groups by canonical order so the layout is deterministic across runs.
    return new Map(
      [...map.entries()].sort(([a], [b]) => GROUP_META[a].order - GROUP_META[b].order)
    );
  }, [query, filter, allNavItems, dataResults, contentHits]);

  // Flat list for keyboard navigation, ordered the same way the UI renders.
  const flatResults = useMemo<UnifiedItem[]>(() => {
    const out: UnifiedItem[] = [];
    for (const items of grouped.values()) out.push(...items);
    return out;
  }, [grouped]);

  /* ── Keep activeIndex in range when results change ────────────────────── */
  useEffect(() => {
    setActiveIndex(0);
  }, [query, filter, dataResults, contentHits]);

  /* ── Scroll active result into view ───────────────────────────────────── */
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector(`[data-result-index="${activeIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const close = useCallback(() => setOpen(false), []);

  const navigate = useCallback(
    (href: string) => {
      const trimmed = query.trim();
      if (trimmed.length >= 2) addRecentSearch(trimmed);
      close();
      router.push(href);
    },
    [close, router, query]
  );

  const cycleFilter = useCallback((direction: 1 | -1) => {
    setFilter((current) => {
      const idx = FILTERS.findIndex((f) => f.key === current);
      const next = (idx + direction + FILTERS.length) % FILTERS.length;
      return FILTERS[next].key;
    });
  }, []);

  /* ── Keyboard handling inside the palette ─────────────────────────────── */
  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (flatResults.length === 0 ? 0 : (i + 1) % flatResults.length));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) =>
          flatResults.length === 0 ? 0 : (i - 1 + flatResults.length) % flatResults.length
        );
        break;
      case "Enter": {
        e.preventDefault();
        const q = query.trim();
        // ⌘/Ctrl-Enter on a query jumps to the full content search page —
        // useful when the inline 3 hits aren't the one you're after.
        if ((e.metaKey || e.ctrlKey) && q.length >= 2) {
          navigate(`/coach/search?q=${encodeURIComponent(q)}`);
        } else if (flatResults[activeIndex]) {
          navigate(flatResults[activeIndex].href);
        }
        break;
      }
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        e.preventDefault();
        cycleFilter(e.shiftKey ? -1 : 1);
        break;
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) close();
  }

  if (!open) return null;

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;
  const noResults = hasQuery && trimmed.length >= 2 && flatResults.length === 0 && !searching;
  const queryTooShort = hasQuery && trimmed.length < 2;
  const activeId = flatResults[activeIndex] ? `cmdk-option-${activeIndex}` : undefined;

  let renderedIndex = 0;

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      {/* Backdrop scrim — translucent is fine here; only the *content panel*
          must be opaque per CLAUDE.md §Overlay Surfaces. */}
      <div className="absolute inset-0 bg-black/70 animate-fade-in" aria-hidden="true" />

      <div
        className="relative w-full max-w-xl bg-[var(--surface-overlay)] border border-[var(--card-border)] rounded-2xl shadow-2xl animate-spring-up overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-[var(--card-border)]">
          <Search
            size={18}
            strokeWidth={1.75}
            className="shrink-0 text-surface-400"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search athletes, sessions, plans, drills…"
            className="flex-1 bg-transparent py-3.5 text-sm text-[var(--foreground)] placeholder:text-surface-400 outline-none font-heading"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={true}
            aria-controls="cmdk-listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeId}
          />
          {searching && (
            <div
              className="w-4 h-4 rounded-full border-2 border-primary-500 border-t-transparent animate-spin"
              aria-label="Searching"
              role="status"
            />
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-nano font-mono font-medium text-surface-400 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
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

        {/* Filter pills */}
        <div
          className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--card-border)] overflow-x-auto custom-scrollbar"
          role="tablist"
          aria-label="Result type filter"
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 px-2.5 py-1 rounded-full text-micro font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                  active
                    ? "bg-primary-500/15 text-primary-700 dark:text-primary-300 border border-primary-500/30"
                    : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border border-transparent hover:text-[var(--foreground)]"
                )}
              >
                {f.label}
              </button>
            );
          })}
          <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-nano text-surface-400 shrink-0 pr-1">
            <kbd className="px-1 py-0.5 rounded font-mono bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
              Tab
            </kbd>
            cycle
          </span>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="cmdk-listbox"
          className="max-h-[50vh] overflow-y-auto custom-scrollbar py-2"
          role="listbox"
        >
          {/* Recent searches — only when no query and not scoped */}
          {!hasQuery && filter === "all" && recentSearches.length > 0 && (
            <>
              <div className="px-4 py-1.5 text-nano font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
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

          {/* Query too short */}
          {queryTooShort && (
            <p className="px-4 py-6 text-sm text-center text-surface-400">
              Keep typing — at least 2 characters.
            </p>
          )}

          {/* No matches */}
          {noResults && (
            <p className="px-4 py-6 text-sm text-center text-surface-400">
              No matches for &ldquo;{query}&rdquo;. Try searching by athlete name or session title.
            </p>
          )}

          {/* Grouped results */}
          {[...grouped.entries()].map(([group, items]) => {
            const meta = GROUP_META[group];
            const isContentGroup = group === "content";
            const showMore = isContentGroup
              ? contentHasMore || contentHits.length > CONTENT_INLINE_DISPLAY
              : group !== "page" && hasMore[group as SearchCategory];
            const showMoreHref = isContentGroup
              ? `/coach/search?q=${encodeURIComponent(trimmed)}`
              : meta.showMoreHref;
            const showMoreLabel = isContentGroup
              ? "See all matches in content"
              : `Show more in ${meta.label}`;
            return (
              <div key={group} role="group" aria-label={meta.label}>
                <div className="px-4 py-1.5 text-nano font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="shrink-0">{meta.icon}</span>
                  {meta.label}
                </div>
                {items.map((item) => {
                  const idx = renderedIndex++;
                  const optionId = `cmdk-option-${idx}`;
                  const isContentRow = item.group === "content";
                  return (
                    <button
                      key={item.key}
                      id={optionId}
                      type="button"
                      role="option"
                      aria-selected={idx === activeIndex}
                      data-result-index={idx}
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        "w-full flex gap-3 px-4 py-2.5 text-sm transition-colors text-left",
                        isContentRow ? "items-start" : "items-center",
                        idx === activeIndex
                          ? "bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300"
                          : "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                      )}
                    >
                      <span
                        className={cn(
                          "w-5 h-5 shrink-0 flex items-center justify-center",
                          isContentRow && "mt-0.5",
                          idx === activeIndex
                            ? "text-primary-600 dark:text-primary-400"
                            : "text-surface-400 dark:text-surface-500"
                        )}
                      >
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={cn("truncate block", isContentRow && "font-medium")}>
                          {item.label}
                        </span>
                        {item.snippet ? (
                          <span className="text-xs text-surface-500 dark:text-surface-400 line-clamp-2 block leading-snug mt-0.5">
                            {item.snippet.map((seg, i) =>
                              seg.marked ? (
                                <mark
                                  key={i}
                                  className="bg-primary-500/25 text-[var(--foreground)] rounded-sm px-0.5"
                                >
                                  {seg.text}
                                </mark>
                              ) : (
                                <span key={i}>{seg.text}</span>
                              )
                            )}
                          </span>
                        ) : (
                          item.subtitle && (
                            <span className="text-xs text-surface-400 dark:text-surface-500 truncate block">
                              {item.subtitle}
                            </span>
                          )
                        )}
                        {isContentRow && item.subtitle && (
                          <span className="text-nano uppercase tracking-wider text-surface-400 dark:text-surface-500 mt-0.5 truncate block">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {showMore && showMoreHref && (
                  <button
                    type="button"
                    onClick={() => navigate(showMoreHref)}
                    className="w-full text-left px-4 py-2 text-micro font-medium text-primary-600 dark:text-primary-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors flex items-center gap-1"
                  >
                    {showMoreLabel}
                    <ArrowRight size={11} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--card-border)] text-nano text-surface-400">
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
              Tab
            </kbd>
            scope
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
