"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  StickyNote,
  Calendar,
  Activity,
  ListChecks,
  Video,
  MessageSquare,
  ScrollText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, SkeletonCard } from "@/components";
import {
  CONTENT_KINDS,
  type ContentHit,
  type ContentKind,
  type ContentSearchResponse,
  type SnippetSegment,
} from "@/lib/search/types";
import { logger } from "@/lib/logger";

type FilterKey = "all" | ContentKind;

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "note", label: "Notes" },
  { key: "session", label: "Sessions" },
  { key: "drill", label: "Drills" },
  { key: "program", label: "Plans" },
  { key: "video", label: "Videos" },
  { key: "feedback", label: "Athlete feedback" },
  { key: "block_note", label: "Block notes" },
];

const KIND_META: Record<ContentKind, { label: string; icon: React.ReactNode; tint: string }> = {
  note: {
    label: "Note",
    icon: <StickyNote size={14} strokeWidth={1.75} aria-hidden="true" />,
    tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  session: {
    label: "Session",
    icon: <Calendar size={14} strokeWidth={1.75} aria-hidden="true" />,
    tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  drill: {
    label: "Drill",
    icon: <Activity size={14} strokeWidth={1.75} aria-hidden="true" />,
    tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  program: {
    label: "Plan",
    icon: <ListChecks size={14} strokeWidth={1.75} aria-hidden="true" />,
    tint: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  video: {
    label: "Video",
    icon: <Video size={14} strokeWidth={1.75} aria-hidden="true" />,
    tint: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  feedback: {
    label: "Athlete feedback",
    icon: <MessageSquare size={14} strokeWidth={1.75} aria-hidden="true" />,
    tint: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
  block_note: {
    label: "Block note",
    icon: <ScrollText size={14} strokeWidth={1.75} aria-hidden="true" />,
    tint: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
  },
};

const DEBOUNCE_MS = 200;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function isFilter(v: string): v is FilterKey {
  return v === "all" || (CONTENT_KINDS as readonly string[]).includes(v);
}

function SnippetText({ segments }: { segments: SnippetSegment[] }) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.marked ? (
          <mark key={i} className="bg-primary-500/25 text-[var(--foreground)] rounded-sm px-0.5">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

interface SearchPageClientProps {
  initialQuery: string;
  initialKind: string;
}

export function SearchPageClient({ initialQuery, initialKind }: SearchPageClientProps) {
  const router = useRouter();
  const initial: FilterKey = isFilter(initialKind) ? initialKind : "all";

  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<FilterKey>(initial);
  const [hits, setHits] = useState<ContentHit[]>([]);
  const [counts, setCounts] = useState<Record<ContentKind, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

  /* ── Sync URL with current query/filter so refresh + share works. ─────── */
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery.trim().length >= 2) params.set("q", debouncedQuery.trim());
    if (filter !== "all") params.set("kind", filter);
    const qs = params.toString();
    router.replace(qs ? `/coach/search?${qs}` : "/coach/search", { scroll: false });
  }, [debouncedQuery, filter, router]);

  /* ── Fetch content hits whenever the debounced query or filter changes. ─ */
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setHits([]);
      setCounts(null);
      setLoading(false);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ q });
    if (filter !== "all") params.set("kind", filter);

    fetch(`/api/search/content?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        return res.json() as Promise<ContentSearchResponse>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setHits(data.hits ?? []);
        setCounts(data.counts ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        logger.warn("content search page fetch failed", {
          context: "coach/search",
          metadata: { reason: err instanceof Error ? err.message : "unknown" },
        });
        setError(err instanceof Error ? err.message : "Search failed");
        setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, filter]);

  /* ── Focus the input on mount so the page is keyboard-ready. ──────────── */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filterCounts = useMemo<Record<FilterKey, number>>(() => {
    const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
    const out: Record<FilterKey, number> = {
      all: total,
      note: 0,
      session: 0,
      drill: 0,
      program: 0,
      video: 0,
      feedback: 0,
      block_note: 0,
    };
    if (counts) {
      for (const k of CONTENT_KINDS) out[k] = counts[k];
    }
    return out;
  }, [counts]);

  const trimmed = debouncedQuery.trim();
  const hasQuery = trimmed.length >= 2;
  const noResults = hasQuery && !loading && hits.length === 0 && !error;

  const handleClear = useCallback(() => {
    setQuery("");
    inputRef.current?.focus();
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-heading">Search</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          Deep search across notes, sessions, drills, plans, video annotations, and athlete
          feedback.
        </p>
      </header>

      {/* Search input */}
      <div className="relative">
        <Search
          size={18}
          strokeWidth={1.75}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search content — e.g. 'hip drive', 'left knee'"
          className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl py-3 pl-10 pr-10 text-sm text-[var(--foreground)] placeholder:text-surface-400 outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          autoComplete="off"
          spellCheck={false}
          aria-label="Content search"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-surface-400 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Clear search"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1"
        role="tablist"
        aria-label="Result type filter"
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = filterCounts[f.key];
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                active
                  ? "bg-primary-500/15 text-primary-700 dark:text-primary-300 border border-primary-500/30"
                  : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border border-transparent hover:text-[var(--foreground)]"
              )}
            >
              {f.label}
              {hasQuery && counts && (
                <span
                  className={cn(
                    "rounded-full text-nano font-mono px-1.5",
                    active
                      ? "bg-primary-500/20 text-primary-700 dark:text-primary-300"
                      : "bg-surface-200/60 dark:bg-surface-700 text-surface-500 dark:text-surface-400"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="space-y-3">
        {!hasQuery && (
          <EmptyState
            icon={<Search size={24} strokeWidth={1.75} aria-hidden="true" />}
            title="Search across your written work"
            description="Type at least two characters. We'll search every coach note, session description, drill cue, program block, and video title."
          />
        )}

        {hasQuery && loading && (
          <div className="space-y-3" aria-busy="true" aria-live="polite">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {error && (
          <EmptyState
            tone="error"
            title="Search failed"
            description={error}
            onRetry={() => setQuery((q) => q + "")}
          />
        )}

        {noResults && (
          <EmptyState
            icon={<Search size={24} strokeWidth={1.75} aria-hidden="true" />}
            title={`No matches for "${trimmed}"`}
            description={
              filter === "all"
                ? "Try a different phrase, or check the spelling. Search looks for case-insensitive substring matches."
                : `No matches in ${KIND_META[filter as ContentKind].label.toLowerCase()}s. Try the "All" filter to broaden.`
            }
          />
        )}

        {hasQuery && !loading && hits.length > 0 && (
          <ul className="space-y-2" role="list">
            {hits.map((hit) => (
              <li key={`${hit.kind}:${hit.id}`}>
                <Link
                  href={hit.href}
                  className="block card card-interactive p-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-nano font-medium uppercase tracking-wider",
                        KIND_META[hit.kind].tint
                      )}
                    >
                      {KIND_META[hit.kind].icon}
                      {KIND_META[hit.kind].label}
                    </span>
                    <time
                      className="text-nano font-mono text-surface-400 dark:text-surface-500 shrink-0"
                      dateTime={hit.createdAt}
                    >
                      {new Date(hit.createdAt).toLocaleDateString()}
                    </time>
                  </div>
                  <h3 className="text-sm font-medium text-[var(--foreground)] truncate">
                    {hit.title}
                  </h3>
                  {hit.parentLabel && (
                    <p className="text-micro text-surface-400 dark:text-surface-500 truncate mt-0.5">
                      {hit.parentLabel}
                    </p>
                  )}
                  <p className="text-xs text-surface-600 dark:text-surface-400 mt-1.5 leading-relaxed line-clamp-3">
                    <SnippetText segments={hit.snippet} />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
