/**
 * Client-side ranker for the command palette.
 *
 * Server returns coarse candidates (DB ILIKE). Locally we re-rank so that:
 *   1. exact prefix matches  (score 0)
 *   2. exact substring matches  (score 1)
 *   3. fuzzy matches via Fuse  (score 2 + fuse.score, threshold 0.4)
 *
 * Why client-side: keystrokes outpace network round-trips, so when a stale
 * candidate set is in hand we can re-rank instantly without a 150ms wait.
 *
 * Pure function — no React, no DOM. Tested in isolation in __tests__/rank.test.ts.
 */

import Fuse from "fuse.js";

export type MatchType = "prefix" | "substring" | "fuzzy";

export interface RankedResult<T> {
  item: T;
  /** Lower = better. Stable across calls so callers can sort ascending. */
  score: number;
  matchType: MatchType;
}

const FUZZY_THRESHOLD = 0.4;
const FUZZY_BASE_SCORE = 2;

interface IndexEntry<T> {
  item: T;
  texts: string[];
}

/**
 * Rank `items` against `query`, evaluating each item against the strings
 * returned by `getSearchableText`. The first string a match is found in
 * wins for that item — ordering of the array is "best field first."
 */
export function rankResults<T>(
  items: T[],
  query: string,
  getSearchableText: (item: T) => string[]
): RankedResult<T>[] {
  const q = query.trim().toLowerCase();
  if (!q || items.length === 0) return [];

  const indexed: IndexEntry<T>[] = items.map((item) => ({
    item,
    texts: getSearchableText(item).map((s) => s.toLowerCase()),
  }));

  const prefixHits: RankedResult<T>[] = [];
  const substringHits: RankedResult<T>[] = [];
  const remaining: IndexEntry<T>[] = [];

  for (const entry of indexed) {
    if (entry.texts.some((t) => t.startsWith(q))) {
      prefixHits.push({ item: entry.item, score: 0, matchType: "prefix" });
    } else if (entry.texts.some((t) => t.includes(q))) {
      substringHits.push({ item: entry.item, score: 1, matchType: "substring" });
    } else {
      remaining.push(entry);
    }
  }

  let fuzzyHits: RankedResult<T>[] = [];
  if (remaining.length > 0) {
    const fuse = new Fuse(remaining, {
      keys: ["texts"],
      includeScore: true,
      threshold: FUZZY_THRESHOLD,
      ignoreLocation: true,
      // `texts` is already lowercased; Fuse handles arrays of strings natively.
    });
    fuzzyHits = fuse.search(q).map((r) => ({
      item: r.item.item,
      score: FUZZY_BASE_SCORE + (r.score ?? 0),
      matchType: "fuzzy" as const,
    }));
  }

  return [...prefixHits, ...substringHits, ...fuzzyHits];
}
