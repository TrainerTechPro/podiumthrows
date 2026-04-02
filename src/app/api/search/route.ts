import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";

const MAX_PER_CATEGORY = 5;

export type SearchResultItem = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  category: "athlete" | "session" | "program" | "pr";
};

export type SearchResponse = {
  results: SearchResultItem[];
  counts: {
    athletes: number;
    sessions: number;
    programs: number;
    prs: number;
  };
};

export async function GET(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();
    const q = new URL(req.url).searchParams.get("q")?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json({
        results: [],
        counts: { athletes: 0, sessions: 0, programs: 0, prs: 0 },
      } satisfies SearchResponse);
    }

    // Run all queries in parallel
    const [athletes, sessions, programs, prs] = await Promise.all([
      // Athletes: search by first/last name
      prisma.athleteProfile.findMany({
        where: {
          coachId: coach.id,
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          events: true,
        },
        take: MAX_PER_CATEGORY,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),

      // Sessions: search by session name
      prisma.throwsSession.findMany({
        where: {
          coachId: coach.id,
          name: { contains: q, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          event: true,
          sessionType: true,
        },
        take: MAX_PER_CATEGORY,
        orderBy: { createdAt: "desc" },
      }),

      // Programs: search by plan name
      prisma.workoutPlan.findMany({
        where: {
          coachId: coach.id,
          name: { contains: q, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          event: true,
        },
        take: MAX_PER_CATEGORY,
        orderBy: { createdAt: "desc" },
      }),

      // Throws PRs: search by athlete name, join through athlete
      prisma.throwsPR.findMany({
        where: {
          athlete: {
            coachId: coach.id,
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
            ],
          },
        },
        select: {
          id: true,
          event: true,
          implement: true,
          distance: true,
          athlete: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        take: MAX_PER_CATEGORY,
        orderBy: { distance: "desc" },
      }),
    ]);

    const EVENT_LABELS: Record<string, string> = {
      SHOT_PUT: "Shot Put",
      DISCUS: "Discus",
      HAMMER: "Hammer",
      JAVELIN: "Javelin",
    };

    const results: SearchResultItem[] = [
      ...athletes.map((a) => ({
        id: a.id,
        title: `${a.firstName} ${a.lastName}`,
        subtitle: (a.events as string[]).map((e) => EVENT_LABELS[e] || e).join(", "),
        href: `/coach/athletes/${a.id}`,
        category: "athlete" as const,
      })),
      ...sessions.map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: `${EVENT_LABELS[s.event] || s.event} · ${s.sessionType.replace(/_/g, " ").toLowerCase()}`,
        href: `/coach/sessions`,
        category: "session" as const,
      })),
      ...programs.map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: p.event ? EVENT_LABELS[p.event] || p.event : "All events",
        href: `/coach/plans`,
        category: "program" as const,
      })),
      ...prs.map((pr) => ({
        id: pr.id,
        title: `${pr.athlete.firstName} ${pr.athlete.lastName} — ${pr.distance.toFixed(2)}m`,
        subtitle: `${EVENT_LABELS[pr.event] || pr.event} · ${pr.implement}`,
        href: `/coach/athletes/${pr.athlete.id}?section=throws`,
        category: "pr" as const,
      })),
    ];

    return NextResponse.json({
      results,
      counts: {
        athletes: athletes.length,
        sessions: sessions.length,
        programs: programs.length,
        prs: prs.length,
      },
    } satisfies SearchResponse);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Search error", { context: "api/search", error: err });
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
