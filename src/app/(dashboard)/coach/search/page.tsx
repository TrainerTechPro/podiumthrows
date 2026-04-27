import type { Metadata } from "next";
import { SearchPageClient } from "./_search-client";

export const metadata: Metadata = {
  title: "Search · Podium Throws",
  description: "Deep search across notes, sessions, drills, plans, and video annotations.",
};

/* ─── /coach/search ───────────────────────────────────────────────────────
   Full-results surface for the content search backed by pg_trgm GIN
   indexes. Reached two ways:
     • ⌘K → "See all matches in content" footer
     • ⌘K → ⌘/Ctrl-Enter on any query
   The CMDK palette stays the fast lane for entity navigation; this page
   is for "find that thing I wrote three months ago about hip drive."
   ─────────────────────────────────────────────────────────────────────── */

export default async function CoachSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const sp = await searchParams;
  const initialQuery = sp.q?.trim() ?? "";
  const initialKind = sp.kind ?? "all";
  return <SearchPageClient initialQuery={initialQuery} initialKind={initialKind} />;
}
