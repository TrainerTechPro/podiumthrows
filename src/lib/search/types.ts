/**
 * Shared types for /api/search and the coach command palette.
 *
 * Lives outside the route file because Next.js Route Handlers reject any
 * non-route export (only GET/POST/etc. + `dynamic`/`runtime`/... allowed).
 */

export const SEARCH_CATEGORIES = [
  "athlete",
  "session",
  "program",
  "pr",
  "drill",
  "exercise",
  "video",
  "note",
] as const;

export type SearchCategory = (typeof SEARCH_CATEGORIES)[number];

export type SearchResultItem = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  category: SearchCategory;
};

export type SearchCounts = Record<SearchCategory, number>;

export type SearchResponse = {
  results: SearchResultItem[];
  counts: SearchCounts;
  /** True when the result set is truncated for any category. */
  hasMore: Partial<Record<SearchCategory, boolean>>;
};

/* ─── Deep content search (free-text grep across coach prose) ─────────────
   Distinct from the entity-name palette above: this hunts for a phrase
   inside notes, session/program copy, drill descriptions, video annotation
   text, etc. Powered by Postgres pg_trgm GIN indexes — see migration
   20260426170000_add_pg_trgm_content_search.
   ───────────────────────────────────────────────────────────────────────── */

export const CONTENT_KINDS = [
  "note",
  "session",
  "drill",
  "program",
  "video",
  "feedback",
  "block_note",
] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];

/** Atomic snippet segment — one is `marked` for a token hit, the rest plain. */
export type SnippetSegment = { text: string; marked: boolean };

export type ContentHit = {
  id: string;
  kind: ContentKind;
  /** Short label rendered as the result row's heading. */
  title: string;
  /** ~160-char window around the match as structured segments. */
  snippet: SnippetSegment[];
  /** Secondary line: athlete name, event, parent program, etc. */
  parentLabel?: string;
  /** Where to navigate when the row is activated. */
  href: string;
  /** Higher = better. Used for cross-kind ordering on the results page. */
  score: number;
  /** ISO of the source row's createdAt — tiebreaker for equal scores. */
  createdAt: string;
};

export type ContentSearchCounts = Record<ContentKind, number>;

export type ContentSearchResponse = {
  hits: ContentHit[];
  counts: ContentSearchCounts;
  /** True when truncation kicked in for any kind. */
  hasMore: Partial<Record<ContentKind, boolean>>;
  /** Echoed back so the client can guard against stale renders. */
  query: string;
};
