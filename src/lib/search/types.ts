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
