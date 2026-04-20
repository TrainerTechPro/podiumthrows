/**
 * Release notes — public changelog source of truth.
 *
 * Entries are consumed by `src/app/changelog/page.tsx` (the public release
 * notes page) and are kept here as a typed array so non-engineers can PR
 * updates without touching page markup. When the list outgrows this file
 * (~20+ entries or weekly cadence from a non-engineer), graduate to the
 * `Release` Prisma model + an admin editor.
 *
 * Editorial rules (see CLAUDE.md for full guidance):
 *   • Headline: verb-led, sentence case, ≤ 60 chars.
 *   • Summary: 2–3 sentences. What shipped → why a coach should care → where
 *     to find it. No "we're excited" filler.
 *   • Date = ship-to-prod date (ISO YYYY-MM-DD), not merge date.
 *   • One entry per user-visible change. Group bug fixes under a single
 *     "Fixes" entry unless each is independently notable.
 */

export type ReleaseAudience = "COACH" | "ATHLETE" | "BOTH";

export type ReleaseTag = "Feature" | "Fix" | "Polish" | "Performance" | "Breaking";

export type ReleaseEntry = {
  /** kebab-case, unique, stable. Used as `#entry-<slug>` anchor. */
  slug: string;
  /** ISO date, ship-to-prod day (YYYY-MM-DD). Drives sort + month grouping. */
  publishedAt: string;
  /** Verb-led, sentence case, ≤ 60 chars. */
  headline: string;
  /** 2–3 sentences. Plain prose — no bullets, no marketing tone. */
  summary: string;
  audience: ReleaseAudience;
  tags?: ReleaseTag[];
  /** Optional deep link. Render only when both ctaText and ctaHref are set. */
  ctaText?: string;
  ctaHref?: string;
};

/**
 * Placeholder entries — REPLACE BEFORE SHIPPING.
 * These exist to establish the visual rhythm of the changelog page (one
 * month with multiple entries, one month with a single entry, varied tag
 * combinations). Swap them for real shipped work from the Notion Release
 * Log (`data_source_id: 360602a3-6352-4561-9977-1913eb644acb`).
 */
export const RELEASES: ReleaseEntry[] = [
  {
    slug: "placeholder-unified-personal-records",
    publishedAt: "2026-04-15",
    headline: "Unified personal records across practice and competition",
    summary:
      "Every throw now flows through a single personal-record engine, so a 19.80m shot in a dual meet updates the same PR as a Tuesday practice throw. Coaches see one number per athlete per implement weight, and the PR celebration fires consistently whether the throw came from Quick Log or a competition entry.",
    audience: "BOTH",
    tags: ["Feature", "Polish"],
    ctaText: "See your PRs",
    ctaHref: "/athlete/throws/records",
  },
  {
    slug: "placeholder-roster-groups",
    publishedAt: "2026-04-08",
    headline: "Group your roster by program, not just by athlete",
    summary:
      "Coaches managing both a university squad and a private group can now keep them in one account without the two lists bleeding together. Each group has its own dashboard, programming, and leaderboard — switch between them from the roster header.",
    audience: "COACH",
    tags: ["Feature"],
    ctaText: "Manage groups",
    ctaHref: "/coach/athletes",
  },
  {
    slug: "placeholder-faster-dashboards",
    publishedAt: "2026-03-27",
    headline: "Dashboards load noticeably faster on slow connections",
    summary:
      "Initial JavaScript on the coach dashboard dropped by roughly a quarter after a pass on bundle splitting and image optimization. You should feel it most on stadium wifi and tethered phones — the first widgets are interactive before the wearable charts finish hydrating.",
    audience: "BOTH",
    tags: ["Performance"],
  },
];

/**
 * Grouped, newest-first, for the public changelog page. Pure — safe to call
 * in a Server Component without memoization.
 */
export function releasesByMonth(): Array<{
  monthKey: string; // "2026-04"
  monthLabel: string; // "April 2026"
  entries: ReleaseEntry[];
}> {
  const sorted = [...RELEASES].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const buckets = new Map<string, ReleaseEntry[]>();
  for (const entry of sorted) {
    const monthKey = entry.publishedAt.slice(0, 7); // "YYYY-MM"
    const bucket = buckets.get(monthKey) ?? [];
    bucket.push(entry);
    buckets.set(monthKey, bucket);
  }

  // Use UTC to format so the month label is stable regardless of server TZ —
  // shipping in March from a west-coast box should not relabel a March 1 entry
  // as February.
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return Array.from(buckets.entries()).map(([monthKey, entries]) => ({
    monthKey,
    monthLabel: formatter.format(new Date(`${monthKey}-01T00:00:00Z`)),
    entries,
  }));
}

/** Short date label for an entry — "Apr 15". UTC-pinned for stability. */
export function formatEntryDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}
