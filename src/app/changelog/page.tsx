import type { Metadata } from "next";
import Link from "next/link";
import { ScrollDepthTracker } from "@/components/analytics/ScrollDepthTracker";
import {
  RELEASES,
  formatEntryDate,
  releasesByMonth,
  type ReleaseAudience,
  type ReleaseEntry,
  type ReleaseTag,
} from "@/lib/releases";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Changelog — Podium Throws",
  description:
    "What's shipped in Podium Throws — product updates for Olympic-level throws coaches and athletes. Newest first.",
  openGraph: {
    title: "Changelog — Podium Throws",
    description:
      "What's shipped in Podium Throws — product updates for throws coaches and athletes.",
  },
  alternates: { canonical: "/changelog" },
};

export default function ChangelogPage() {
  const months = releasesByMonth();

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 py-12 sm:py-16 px-4">
      <ScrollDepthTracker />
      <main className="max-w-2xl mx-auto">
        <header className="space-y-3 mb-10 sm:mb-14">
          <Link
            href="/"
            className="inline-block text-sm text-primary-500 hover:text-primary-400 transition-colors"
          >
            &larr; Back to home
          </Link>
          <h1 className="text-display-sm sm:text-display font-heading text-[var(--foreground)]">
            What&rsquo;s new
          </h1>
          <p className="text-muted leading-relaxed">
            Product updates, shipped. Newest first. Grouped by month.
          </p>
        </header>

        {months.length === 0 ? (
          <EmptyChangelog />
        ) : (
          <div className="space-y-12 sm:space-y-16">
            {months.map((month) => (
              <MonthSection key={month.monthKey} {...month} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* ─── Month section ─────────────────────────────────────────────────────── */

function MonthSection({
  monthKey,
  monthLabel,
  entries,
}: {
  monthKey: string;
  monthLabel: string;
  entries: ReleaseEntry[];
}) {
  const headingId = `month-${monthKey}`;
  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="text-xs font-semibold uppercase tracking-[0.14em] text-muted mb-5 font-mono"
      >
        <time dateTime={monthKey}>{monthLabel}</time>
      </h2>
      <ol role="list" className="space-y-5 sm:space-y-6">
        {entries.map((entry) => (
          <li key={entry.slug}>
            <ReleaseCard entry={entry} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ─── Release card ──────────────────────────────────────────────────────── */

function ReleaseCard({ entry }: { entry: ReleaseEntry }) {
  const anchor = `entry-${entry.slug}`;
  const headlineId = `${anchor}-title`;

  return (
    <article
      id={anchor}
      aria-labelledby={headlineId}
      className="card p-5 sm:p-6 space-y-3 scroll-mt-20"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <time
          dateTime={entry.publishedAt}
          className="text-xs font-mono text-muted tabular-nums shrink-0"
        >
          {formatEntryDate(entry.publishedAt)}
        </time>
        <h3
          id={headlineId}
          className="text-lg font-heading font-semibold text-[var(--foreground)] leading-snug"
        >
          <a href={`#${anchor}`} className="hover:text-primary-500 transition-colors">
            {entry.headline}
          </a>
        </h3>
      </header>

      <p className="text-sm sm:text-base text-muted leading-relaxed">{entry.summary}</p>

      <footer className="flex flex-wrap items-center gap-2 pt-1">
        <AudienceBadge audience={entry.audience} />
        {entry.tags?.map((tag) => (
          <TagBadge key={tag} tag={tag} />
        ))}
        {entry.ctaText && entry.ctaHref && (
          <Link
            href={entry.ctaHref}
            className="ml-auto text-sm font-medium text-primary-500 hover:text-primary-400 transition-colors"
          >
            {entry.ctaText} &rarr;
          </Link>
        )}
      </footer>
    </article>
  );
}

/* ─── Badges ────────────────────────────────────────────────────────────── */

const AUDIENCE_LABEL: Record<ReleaseAudience, string> = {
  COACH: "Coach",
  ATHLETE: "Athlete",
  BOTH: "Everyone",
};

function AudienceBadge({ audience }: { audience: ReleaseAudience }) {
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--card-border)] bg-surface-100 dark:bg-surface-900 px-2 py-0.5 text-xs font-medium text-muted">
      {AUDIENCE_LABEL[audience]}
    </span>
  );
}

const TAG_STYLE: Record<ReleaseTag, string> = {
  Feature: "bg-primary-500/10 text-primary-500 border border-primary-500/20",
  Fix: "bg-green-500/10 text-green-400 border border-green-500/20",
  Polish: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  Performance: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  Breaking: "bg-red-500/10 text-red-400 border border-red-500/20",
};

function TagBadge({ tag }: { tag: ReleaseTag }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${TAG_STYLE[tag]}`}
    >
      {tag}
    </span>
  );
}

/* ─── Empty state ───────────────────────────────────────────────────────── */

function EmptyChangelog() {
  return (
    <div className="card p-8 text-center space-y-2">
      <p className="font-heading text-lg text-[var(--foreground)]">Nothing to report yet.</p>
      <p className="text-sm text-muted">New releases will show up here as we ship them.</p>
    </div>
  );
}

/* ─── Build-time sanity check ───────────────────────────────────────────── */
// If this grows, move to a test. For now, fail the build on obvious mistakes.
if (process.env.NODE_ENV !== "production") {
  const slugs = new Set<string>();
  for (const entry of RELEASES) {
    if (slugs.has(entry.slug)) {
      throw new Error(`Duplicate release slug: ${entry.slug}`);
    }
    slugs.add(entry.slug);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.publishedAt)) {
      throw new Error(
        `Release "${entry.slug}" has invalid publishedAt (expected YYYY-MM-DD, got "${entry.publishedAt}")`
      );
    }
  }
}
