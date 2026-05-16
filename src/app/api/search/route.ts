import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import {
  SEARCH_CATEGORIES,
  type SearchCategory,
  type SearchResultItem,
  type SearchCounts,
  type SearchResponse,
} from "@/lib/search/types";

/* ─── /api/search ────────────────────────────────────────────────────────────
   Unified coach-side command palette backend. Returns coarse candidates
   across nine entity types in one round-trip. The client re-ranks (prefix
   > substring > fuzzy) and groups by category — see src/lib/search/rank.ts
   and src/components/ui/CommandPalette.tsx.

   `?q=`        — search term (min 2 chars).
   `?category=` — restrict to a single category. Defaults to "all".

   Auth: coach-only (athletes use the consumer search elsewhere).
   ───────────────────────────────────────────────────────────────────────── */

const MAX_PER_CATEGORY = 8;

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

const EMPTY_COUNTS: SearchCounts = {
  athlete: 0,
  session: 0,
  program: 0,
  pr: 0,
  drill: 0,
  exercise: 0,
  video: 0,
  note: 0,
};

function emptyResponse(): SearchResponse {
  return { results: [], counts: { ...EMPTY_COUNTS }, hasMore: {} };
}

function isCategory(v: string | null): v is SearchCategory {
  return !!v && (SEARCH_CATEGORIES as readonly string[]).includes(v);
}

export async function GET(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const categoryParam = url.searchParams.get("category");
    const scoped: SearchCategory | "all" = isCategory(categoryParam) ? categoryParam : "all";

    if (!q || q.length < 2) {
      return NextResponse.json(emptyResponse() satisfies SearchResponse);
    }

    const want = (c: SearchCategory): boolean => scoped === "all" || scoped === c;
    // Pull MAX+1 so we can detect "more available" without a separate count query.
    const take = MAX_PER_CATEGORY + 1;
    const insensitive: Prisma.QueryMode = "insensitive";

    const [athletes, sessions, programs, prs, drills, exercises, videos, notes] = await Promise.all(
      [
        want("athlete")
          ? prisma.athleteProfile.findMany({
              where: {
                coachId: coach.id,
                OR: [
                  { firstName: { contains: q, mode: insensitive } },
                  { lastName: { contains: q, mode: insensitive } },
                ],
              },
              select: { id: true, firstName: true, lastName: true, events: true },
              take,
              orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
            })
          : [],

        want("session")
          ? prisma.throwsSession.findMany({
              where: {
                coachId: coach.id,
                name: { contains: q, mode: insensitive },
              },
              select: { id: true, name: true, event: true, sessionType: true },
              take,
              orderBy: { createdAt: "desc" },
            })
          : [],

        want("program")
          ? prisma.workoutPlan.findMany({
              where: {
                coachId: coach.id,
                OR: [
                  { name: { contains: q, mode: insensitive } },
                  { description: { contains: q, mode: insensitive } },
                ],
              },
              select: { id: true, name: true, event: true },
              take,
              orderBy: { createdAt: "desc" },
            })
          : [],

        want("pr")
          ? // Catalog-keyed PR search — reshape to the legacy {event,
            // implement, distance} contract the search results UI consumes.
            // (athleteId, implementId) uniqueness eliminates the
            // duplicate-label rows that polluted the legacy ThrowsPR-backed
            // search results.
            prisma.athleteImplementPR
              .findMany({
                where: {
                  bestDistance: { not: null },
                  athlete: {
                    coachId: coach.id,
                    OR: [
                      { firstName: { contains: q, mode: insensitive } },
                      { lastName: { contains: q, mode: insensitive } },
                    ],
                  },
                },
                include: {
                  implement: { select: { throwType: true, displayLabel: true } },
                  athlete: { select: { id: true, firstName: true, lastName: true } },
                },
                take,
                orderBy: { bestDistance: "desc" },
              })
              .then((rows) =>
                rows.map((pr) => ({
                  id: pr.id,
                  event: pr.implement.throwType === "SHOT" ? "SHOT_PUT" : pr.implement.throwType,
                  implement: pr.implement.displayLabel,
                  distance: pr.bestDistance!,
                  athlete: pr.athlete,
                }))
              )
          : [],

        want("drill")
          ? prisma.drill.findMany({
              where: {
                // Coach's own drills + global library drills both count —
                // global drills are visible across coaches by design.
                OR: [{ coachId: coach.id }, { isGlobal: true }],
                AND: [
                  {
                    OR: [
                      { name: { contains: q, mode: insensitive } },
                      { description: { contains: q, mode: insensitive } },
                    ],
                  },
                ],
              },
              select: { id: true, name: true, event: true, category: true, difficulty: true },
              take,
              orderBy: [{ isGlobal: "asc" }, { name: "asc" }],
            })
          : [],

        want("exercise")
          ? prisma.exercise.findMany({
              where: {
                OR: [{ coachId: coach.id }, { isGlobal: true }],
                AND: [{ name: { contains: q, mode: insensitive } }],
              },
              select: { id: true, name: true, event: true, category: true, equipment: true },
              take,
              orderBy: [{ isGlobal: "asc" }, { name: "asc" }],
            })
          : [],

        want("video")
          ? prisma.videoAnalysis.findMany({
              where: {
                coachId: coach.id,
                OR: [
                  { title: { contains: q, mode: insensitive } },
                  { description: { contains: q, mode: insensitive } },
                ],
              },
              select: {
                id: true,
                title: true,
                event: true,
                athlete: { select: { id: true, firstName: true, lastName: true } },
              },
              take,
              orderBy: { createdAt: "desc" },
            })
          : [],

        want("note")
          ? prisma.coachNote.findMany({
              where: {
                coachProfileId: coach.id,
                content: { contains: q, mode: insensitive },
              },
              select: {
                id: true,
                content: true,
                category: true,
                athlete: { select: { id: true, firstName: true, lastName: true } },
                createdAt: true,
              },
              take,
              orderBy: { createdAt: "desc" },
            })
          : [],
      ]
    );

    const trimmed = <T>(rows: T[]): { items: T[]; more: boolean } => ({
      items: rows.slice(0, MAX_PER_CATEGORY),
      more: rows.length > MAX_PER_CATEGORY,
    });

    const aT = trimmed(athletes);
    const sT = trimmed(sessions);
    const pT = trimmed(programs);
    const prT = trimmed(prs);
    const dT = trimmed(drills);
    const eT = trimmed(exercises);
    const vT = trimmed(videos);
    const nT = trimmed(notes);

    const formatCategory = (c: string) => c.replace(/_/g, " ").toLowerCase();
    const eventLabel = (e: string | null | undefined) =>
      e ? (EVENT_LABELS[e] ?? e) : "All events";

    const results: SearchResultItem[] = [
      ...aT.items.map((a) => ({
        id: a.id,
        title: `${a.firstName} ${a.lastName}`,
        subtitle: (a.events as string[]).map((e) => EVENT_LABELS[e] || e).join(", ") || undefined,
        href: `/coach/athletes/${a.id}`,
        category: "athlete" as const,
      })),
      ...sT.items.map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: `${eventLabel(s.event)} · ${formatCategory(s.sessionType)}`,
        href: `/coach/throws/${s.id}`,
        category: "session" as const,
      })),
      ...pT.items.map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: eventLabel(p.event),
        href: `/coach/plans/${p.id}`,
        category: "program" as const,
      })),
      ...prT.items.map((pr) => ({
        id: pr.id,
        title: `${pr.athlete.firstName} ${pr.athlete.lastName} — ${pr.distance.toFixed(2)}m`,
        subtitle: `${eventLabel(pr.event)} · ${pr.implement}`,
        href: `/coach/athletes/${pr.athlete.id}?section=throws`,
        category: "pr" as const,
      })),
      ...dT.items.map((d) => ({
        id: d.id,
        title: d.name,
        subtitle: [eventLabel(d.event), formatCategory(d.category), d.difficulty]
          .filter(Boolean)
          .join(" · "),
        href: `/coach/throws/drills?focus=${d.id}`,
        category: "drill" as const,
      })),
      ...eT.items.map((e) => ({
        id: e.id,
        title: e.name,
        subtitle: [eventLabel(e.event), formatCategory(e.category), e.equipment]
          .filter(Boolean)
          .join(" · "),
        href: `/coach/exercises`,
        category: "exercise" as const,
      })),
      ...vT.items.map((v) => ({
        id: v.id,
        title: v.title,
        subtitle: [`${v.athlete.firstName} ${v.athlete.lastName}`, eventLabel(v.event)]
          .filter(Boolean)
          .join(" · "),
        href: `/coach/video-analysis/${v.id}`,
        category: "video" as const,
      })),
      ...nT.items.map((n) => {
        const snippet = n.content.length > 80 ? `${n.content.slice(0, 80).trim()}…` : n.content;
        return {
          id: n.id,
          title: snippet,
          subtitle: `${n.athlete.firstName} ${n.athlete.lastName} · ${formatCategory(n.category)}`,
          href: `/coach/athletes/${n.athlete.id}?tab=notes`,
          category: "note" as const,
        };
      }),
    ];

    const counts: SearchCounts = {
      athlete: aT.items.length,
      session: sT.items.length,
      program: pT.items.length,
      pr: prT.items.length,
      drill: dT.items.length,
      exercise: eT.items.length,
      video: vT.items.length,
      note: nT.items.length,
    };

    const hasMore: Partial<Record<SearchCategory, boolean>> = {};
    if (aT.more) hasMore.athlete = true;
    if (sT.more) hasMore.session = true;
    if (pT.more) hasMore.program = true;
    if (prT.more) hasMore.pr = true;
    if (dT.more) hasMore.drill = true;
    if (eT.more) hasMore.exercise = true;
    if (vT.more) hasMore.video = true;
    if (nT.more) hasMore.note = true;

    return NextResponse.json({ results, counts, hasMore } satisfies SearchResponse);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Search error", { context: "api/search", error: err });
    return NextResponse.json({ success: false, error: "Search failed" }, { status: 500 });
  }
}
