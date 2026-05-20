import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import {
  CONTENT_KINDS,
  type ContentKind,
  type ContentHit,
  type ContentSearchCounts,
  type ContentSearchResponse,
} from "@/lib/search/types";
import { buildSnippet, scoreMatch, tokenizeQuery } from "@/lib/search/snippet";

/* ─── /api/search/content ────────────────────────────────────────────────────
   Free-text grep across coach prose: notes, session/program copy, drill
   descriptions, video annotations, athlete feedback, block notes.

   The `?q=` term goes through Postgres ILIKE against columns backed by a
   `gin_trgm_ops` index (migration 20260426170000) — the planner uses the
   index even for `%term%` patterns, so this stays sub-100ms on rosters with
   tens of thousands of notes.

   Ranking happens after the DB returns rows, so it can mix per-kind weights
   with match position and source-text length. See `scoreMatch` in
   `src/lib/search/snippet.ts`.

   Auth: coach-only. Athletes will get a separate consumer-shaped surface.
   ─────────────────────────────────────────────────────────────────────────── */

const MAX_PER_KIND = 10;
const MAX_RAW_FETCH = 25; // pull more than we keep so ranking can re-order

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

// Per-kind static weight used by scoreMatch. Drills and notes carry the
// most signal for "I'm looking for that thing I wrote" — videos and feedback
// rank lower because their text is usually descriptive, not authoritative.
const KIND_WEIGHT: Record<ContentKind, number> = {
  drill: 1.2,
  note: 1.15,
  program: 1.05,
  session: 1.0,
  video: 0.95,
  block_note: 0.9,
  feedback: 0.8,
};

const EMPTY_COUNTS: ContentSearchCounts = {
  note: 0,
  session: 0,
  drill: 0,
  program: 0,
  video: 0,
  feedback: 0,
  block_note: 0,
};

function emptyResponse(query: string): ContentSearchResponse {
  return { hits: [], counts: { ...EMPTY_COUNTS }, hasMore: {}, query };
}

function isKind(v: string | null): v is ContentKind {
  return !!v && (CONTENT_KINDS as readonly string[]).includes(v);
}

function eventLabel(e: string | null | undefined): string | undefined {
  if (!e) return undefined;
  return EVENT_LABELS[e] ?? e;
}

function athleteName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

export async function GET(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();
    const url = new URL(req.url);
    const rawQ = url.searchParams.get("q")?.trim() ?? "";
    const kindParam = url.searchParams.get("kind");
    const scoped: ContentKind | "all" = isKind(kindParam) ? kindParam : "all";

    if (rawQ.length < 2) {
      return NextResponse.json(emptyResponse(rawQ));
    }

    const tokens = tokenizeQuery(rawQ);
    if (!tokens.length) {
      return NextResponse.json(emptyResponse(rawQ));
    }

    // The "primary" token drives the SQL ILIKE — multi-token queries narrow
    // further in JS via scoreMatch. Single-token searches dominate this UI
    // (coaches type "hip drive" not "hip AND drive"), so this is fine.
    const primary = tokens.reduce((longest, t) => (t.length > longest.length ? t : longest));
    const insensitive: Prisma.QueryMode = "insensitive";
    const want = (k: ContentKind): boolean => scoped === "all" || scoped === k;
    const take = MAX_RAW_FETCH;

    const [notes, sessions, drills, programs, videos, feedbacks, blockNotes] = await Promise.all([
      want("note")
        ? prisma.coachNote.findMany({
            where: {
              coachProfileId: coach.id,
              content: { contains: primary, mode: insensitive },
            },
            select: {
              id: true,
              content: true,
              category: true,
              createdAt: true,
              athlete: { select: { id: true, firstName: true, lastName: true } },
            },
            take,
            orderBy: { createdAt: "desc" },
          })
        : [],

      want("session")
        ? prisma.throwsSession.findMany({
            where: {
              coachId: coach.id,
              OR: [
                { name: { contains: primary, mode: insensitive } },
                { notes: { contains: primary, mode: insensitive } },
              ],
            },
            select: {
              id: true,
              name: true,
              notes: true,
              event: true,
              sessionType: true,
              createdAt: true,
            },
            take,
            orderBy: { createdAt: "desc" },
          })
        : [],

      want("drill")
        ? prisma.drill.findMany({
            where: {
              OR: [{ coachId: coach.id }, { isGlobal: true }],
              AND: [
                {
                  OR: [
                    { name: { contains: primary, mode: insensitive } },
                    { description: { contains: primary, mode: insensitive } },
                  ],
                },
              ],
            },
            select: {
              id: true,
              name: true,
              description: true,
              event: true,
              category: true,
              difficulty: true,
              isGlobal: true,
              createdAt: true,
            },
            take,
            orderBy: [{ isGlobal: "asc" }, { name: "asc" }],
          })
        : [],

      want("program")
        ? prisma.workoutPlan.findMany({
            where: {
              coachId: coach.id,
              OR: [
                { name: { contains: primary, mode: insensitive } },
                { description: { contains: primary, mode: insensitive } },
              ],
            },
            select: {
              id: true,
              name: true,
              description: true,
              event: true,
              phase: true,
              createdAt: true,
            },
            take,
            orderBy: { createdAt: "desc" },
          })
        : [],

      want("video")
        ? prisma.videoAnalysis.findMany({
            where: {
              coachId: coach.id,
              OR: [
                { title: { contains: primary, mode: insensitive } },
                { description: { contains: primary, mode: insensitive } },
              ],
            },
            select: {
              id: true,
              title: true,
              description: true,
              event: true,
              createdAt: true,
              athlete: { select: { id: true, firstName: true, lastName: true } },
            },
            take,
            orderBy: { createdAt: "desc" },
          })
        : [],

      want("feedback")
        ? prisma.throwsAssignment.findMany({
            where: {
              session: { coachId: coach.id },
              feedbackNotes: { contains: primary, mode: insensitive },
            },
            select: {
              id: true,
              feedbackNotes: true,
              rpe: true,
              completedAt: true,
              createdAt: true,
              session: { select: { id: true, name: true, event: true } },
              athlete: { select: { id: true, firstName: true, lastName: true } },
            },
            take,
            orderBy: { createdAt: "desc" },
          })
        : [],

      want("block_note")
        ? prisma.workoutBlock.findMany({
            where: {
              plan: { coachId: coach.id },
              notes: { contains: primary, mode: insensitive },
            },
            select: {
              id: true,
              name: true,
              blockType: true,
              notes: true,
              plan: { select: { id: true, name: true, event: true } },
            },
            take,
            orderBy: { name: "asc" },
          })
        : [],
    ]);

    const formatCategory = (c: string) => c.replace(/_/g, " ").toLowerCase();
    const indexOfCi = (text: string, term: string): number =>
      text.toLowerCase().indexOf(term.toLowerCase());

    const noteHits: ContentHit[] = notes.map((n) => {
      const offset = indexOfCi(n.content, primary);
      return {
        id: n.id,
        kind: "note" as const,
        title: `${athleteName(n.athlete)} · ${formatCategory(n.category)}`,
        snippet: buildSnippet(n.content, rawQ),
        parentLabel: n.athlete.firstName ? `Note on ${athleteName(n.athlete)}` : undefined,
        href: `/coach/athletes/${n.athlete.id}?tab=notes#note-${n.id}`,
        score: scoreMatch({
          textLength: n.content.length,
          matchOffset: offset,
          kindWeight: KIND_WEIGHT.note,
        }),
        createdAt: n.createdAt.toISOString(),
      };
    });

    const sessionHits: ContentHit[] = sessions.map((s) => {
      const titleOffset = indexOfCi(s.name, primary);
      const inTitle = titleOffset !== -1;
      const body = s.notes ?? "";
      const bodyOffset = body ? indexOfCi(body, primary) : -1;
      const sourceText = inTitle ? s.name : body || s.name;
      return {
        id: s.id,
        kind: "session" as const,
        title: s.name,
        snippet: buildSnippet(body || s.name, rawQ),
        parentLabel: [eventLabel(s.event), formatCategory(s.sessionType)]
          .filter(Boolean)
          .join(" · "),
        href: `/coach/throws/${s.id}`,
        score: scoreMatch({
          textLength: sourceText.length,
          matchOffset: inTitle ? titleOffset : bodyOffset,
          kindWeight: KIND_WEIGHT.session,
          titleHit: inTitle,
        }),
        createdAt: s.createdAt.toISOString(),
      };
    });

    const drillHits: ContentHit[] = drills.map((d) => {
      const titleOffset = indexOfCi(d.name, primary);
      const inTitle = titleOffset !== -1;
      const body = d.description ?? "";
      const bodyOffset = body ? indexOfCi(body, primary) : -1;
      const sourceText = inTitle ? d.name : body || d.name;
      return {
        id: d.id,
        kind: "drill" as const,
        title: d.name,
        snippet: buildSnippet(body || d.name, rawQ),
        parentLabel: [
          eventLabel(d.event),
          formatCategory(d.category),
          d.difficulty,
          d.isGlobal ? "Library drill" : undefined,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/coach/library?view=drills&focus=${d.id}`,
        score: scoreMatch({
          textLength: sourceText.length,
          matchOffset: inTitle ? titleOffset : bodyOffset,
          kindWeight: KIND_WEIGHT.drill,
          titleHit: inTitle,
        }),
        createdAt: d.createdAt.toISOString(),
      };
    });

    const programHits: ContentHit[] = programs.map((p) => {
      const titleOffset = indexOfCi(p.name, primary);
      const inTitle = titleOffset !== -1;
      const body = p.description ?? "";
      const bodyOffset = body ? indexOfCi(body, primary) : -1;
      const sourceText = inTitle ? p.name : body || p.name;
      return {
        id: p.id,
        kind: "program" as const,
        title: p.name,
        snippet: buildSnippet(body || p.name, rawQ),
        parentLabel: [eventLabel(p.event), p.phase ?? undefined].filter(Boolean).join(" · "),
        href: `/coach/plans/${p.id}`,
        score: scoreMatch({
          textLength: sourceText.length,
          matchOffset: inTitle ? titleOffset : bodyOffset,
          kindWeight: KIND_WEIGHT.program,
          titleHit: inTitle,
        }),
        createdAt: p.createdAt.toISOString(),
      };
    });

    const videoHits: ContentHit[] = videos.map((v) => {
      const titleOffset = indexOfCi(v.title, primary);
      const inTitle = titleOffset !== -1;
      const body = v.description ?? "";
      const bodyOffset = body ? indexOfCi(body, primary) : -1;
      const sourceText = inTitle ? v.title : body || v.title;
      return {
        id: v.id,
        kind: "video" as const,
        title: v.title,
        snippet: buildSnippet(body || v.title, rawQ),
        parentLabel: [athleteName(v.athlete), eventLabel(v.event)].filter(Boolean).join(" · "),
        href: `/coach/video-analysis/${v.id}`,
        score: scoreMatch({
          textLength: sourceText.length,
          matchOffset: inTitle ? titleOffset : bodyOffset,
          kindWeight: KIND_WEIGHT.video,
          titleHit: inTitle,
        }),
        createdAt: v.createdAt.toISOString(),
      };
    });

    const feedbackHits: ContentHit[] = feedbacks
      .filter((f) => f.feedbackNotes && f.feedbackNotes.length > 0)
      .map((f) => {
        const body = f.feedbackNotes ?? "";
        const offset = indexOfCi(body, primary);
        return {
          id: f.id,
          kind: "feedback" as const,
          title: `${athleteName(f.athlete)} · ${f.session.name}`,
          snippet: buildSnippet(body, rawQ),
          parentLabel: [eventLabel(f.session.event), f.rpe != null ? `RPE ${f.rpe}` : undefined]
            .filter(Boolean)
            .join(" · "),
          href: `/coach/athletes/${f.athlete.id}?session=${f.id}`,
          score: scoreMatch({
            textLength: body.length,
            matchOffset: offset,
            kindWeight: KIND_WEIGHT.feedback,
          }),
          createdAt: (f.completedAt ?? f.createdAt).toISOString(),
        };
      });

    const blockNoteHits: ContentHit[] = blockNotes
      .filter((b) => b.notes && b.notes.length > 0)
      .map((b) => {
        const body = b.notes ?? "";
        const offset = indexOfCi(body, primary);
        return {
          id: b.id,
          kind: "block_note" as const,
          title: `${b.name} · ${b.plan.name}`,
          snippet: buildSnippet(body, rawQ),
          parentLabel: [eventLabel(b.plan.event), formatCategory(b.blockType)]
            .filter(Boolean)
            .join(" · "),
          href: `/coach/plans/${b.plan.id}#block-${b.id}`,
          score: scoreMatch({
            textLength: body.length,
            matchOffset: offset,
            kindWeight: KIND_WEIGHT.block_note,
          }),
          // WorkoutBlock has no createdAt on the schema — fall back to "now"
          // so equal-score sort still sees a stable string.
          createdAt: new Date(0).toISOString(),
        };
      });

    const trim = (rows: ContentHit[]): { items: ContentHit[]; more: boolean } => {
      const sorted = [...rows].sort((a, b) =>
        b.score === a.score ? b.createdAt.localeCompare(a.createdAt) : b.score - a.score
      );
      return {
        items: sorted.slice(0, MAX_PER_KIND),
        more: sorted.length > MAX_PER_KIND,
      };
    };

    const buckets: Record<ContentKind, { items: ContentHit[]; more: boolean }> = {
      note: trim(noteHits),
      session: trim(sessionHits),
      drill: trim(drillHits),
      program: trim(programHits),
      video: trim(videoHits),
      feedback: trim(feedbackHits),
      block_note: trim(blockNoteHits),
    };

    const allHits = (Object.keys(buckets) as ContentKind[]).flatMap((k) => buckets[k].items);
    allHits.sort((a, b) =>
      b.score === a.score ? b.createdAt.localeCompare(a.createdAt) : b.score - a.score
    );

    const counts: ContentSearchCounts = {
      note: buckets.note.items.length,
      session: buckets.session.items.length,
      drill: buckets.drill.items.length,
      program: buckets.program.items.length,
      video: buckets.video.items.length,
      feedback: buckets.feedback.items.length,
      block_note: buckets.block_note.items.length,
    };

    const hasMore: Partial<Record<ContentKind, boolean>> = {};
    for (const k of CONTENT_KINDS) {
      if (buckets[k].more) hasMore[k] = true;
    }

    return NextResponse.json({
      hits: allHits,
      counts,
      hasMore,
      query: rawQ,
    } satisfies ContentSearchResponse);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Content search error", { context: "api/search/content", error: err });
    return NextResponse.json({ success: false, error: "Search failed" }, { status: 500 });
  }
}
