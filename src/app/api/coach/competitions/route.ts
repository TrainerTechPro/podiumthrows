import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import { COMPETITION_WEIGHTS } from "@/lib/throws";

/* ─── GET — list all meets for coach's roster ─────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();
    const url = new URL(req.url);
    const filter = url.searchParams.get("filter"); // "upcoming" | "past" | null (all)

    const today = new Date().toISOString().split("T")[0];

    // Fetch all competitions for athletes on this coach's roster
    const competitions = await prisma.throwsCompetition.findMany({
      where: {
        athlete: { coachId: coach.id },
        ...(filter === "upcoming" ? { date: { gte: today } } : {}),
        ...(filter === "past" ? { date: { lt: today } } : {}),
      },
      include: {
        athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            gender: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    // Group by meet (name + date) for the list view
    const meetMap = new Map<
      string,
      {
        name: string;
        date: string;
        priority: string;
        entries: typeof competitions;
        totalResults: number;
        totalEntries: number;
        events: Set<string>;
      }
    >();

    for (const c of competitions) {
      const key = `${c.name}::${c.date}`;
      if (!meetMap.has(key)) {
        meetMap.set(key, {
          name: c.name,
          date: c.date,
          priority: c.priority,
          entries: [],
          totalResults: 0,
          totalEntries: 0,
          events: new Set(),
        });
      }
      const meet = meetMap.get(key)!;
      meet.entries.push(c);
      meet.totalEntries++;
      if (c.result != null) meet.totalResults++;
      meet.events.add(c.event);
      // Use highest priority among entries
      if (c.priority === "A" || (c.priority === "B" && meet.priority === "C")) {
        meet.priority = c.priority;
      }
    }

    const meets = Array.from(meetMap.values()).map((m) => ({
      name: m.name,
      date: m.date,
      priority: m.priority,
      events: Array.from(m.events),
      totalEntries: m.totalEntries,
      totalResults: m.totalResults,
      entries: m.entries.map((e) => ({
        id: e.id,
        athleteId: e.athleteId,
        athleteName: `${e.athlete.firstName} ${e.athlete.lastName}`,
        avatarUrl: e.athlete.avatarUrl,
        gender: e.athlete.gender,
        event: e.event,
        result: e.result,
        resultBy: e.resultBy,
        notes: e.notes,
      })),
    }));

    return NextResponse.json({ success: true, data: meets });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("coach competitions GET error", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to fetch competitions" }, { status: 500 });
  }
}

/* ─── POST — batch-create competition entries for a meet ──────────────────── */

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();
    const body = await req.json();
    const { name, date, priority, entries } = body as {
      name: string;
      date: string;
      priority?: string;
      entries: { athleteId: string; event: string }[];
    };

    if (!name?.trim() || !date?.trim() || !entries?.length) {
      return NextResponse.json(
        { error: "name, date, and entries[] are required" },
        { status: 400 },
      );
    }

    // Verify all athletes belong to this coach
    const athleteIds = [...new Set(entries.map((e) => e.athleteId))];
    const athletes = await prisma.athleteProfile.findMany({
      where: { id: { in: athleteIds }, coachId: coach.id },
      select: { id: true },
    });
    const validIds = new Set(athletes.map((a) => a.id));
    const invalidIds = athleteIds.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Athletes not on your roster: ${invalidIds.join(", ")}` },
        { status: 403 },
      );
    }

    // Create all competition entries in a transaction
    const created = await prisma.$transaction(
      entries.map((entry) =>
        prisma.throwsCompetition.create({
          data: {
            athleteId: entry.athleteId,
            name: name.trim(),
            date: date.trim(),
            event: entry.event,
            priority: priority || "B",
          },
        }),
      ),
    );

    return NextResponse.json({ success: true, data: created });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("coach competitions POST error", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to create competition entries" }, { status: 500 });
  }
}

/* ─── PATCH — batch-update results + PR detection ─────────────────────────── */

export async function PATCH(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();
    const body = await req.json();
    const { results } = body as {
      results: { id: string; result: number | null; notes?: string | null }[];
    };

    if (!results?.length) {
      return NextResponse.json({ error: "results[] is required" }, { status: 400 });
    }

    // Fetch all competition entries to verify ownership + get event/athlete info
    const ids = results.map((r) => r.id);
    const existing = await prisma.throwsCompetition.findMany({
      where: { id: { in: ids } },
      include: {
        athlete: {
          select: {
            id: true,
            coachId: true,
            firstName: true,
            lastName: true,
            gender: true,
          },
        },
      },
    });

    // Verify all entries belong to this coach's athletes
    const existingMap = new Map(existing.map((e) => [e.id, e]));
    for (const r of results) {
      const comp = existingMap.get(r.id);
      if (!comp) {
        return NextResponse.json({ error: `Competition ${r.id} not found` }, { status: 404 });
      }
      if (comp.athlete.coachId !== coach.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Update results and detect PRs
    const prs: {
      athleteId: string;
      athleteName: string;
      event: string;
      distance: number;
      previousBest: number | null;
    }[] = [];

    for (const r of results) {
      const comp = existingMap.get(r.id)!;

      // Update the competition result
      await prisma.throwsCompetition.update({
        where: { id: r.id },
        data: {
          result: r.result ?? null,
          resultBy: "COACH",
          ...(r.notes !== undefined && { notes: r.notes || null }),
        },
      });

      // PR detection: compare against ThrowsPR for competition weight
      if (r.result != null && r.result > 0) {
        const gender = comp.athlete.gender === "MALE" ? "male" : "female";
        const compWeight = COMPETITION_WEIGHTS[comp.event]?.[gender];
        if (compWeight) {
          const implementStr = `${compWeight}kg`;
          const existingPR = await prisma.throwsPR.findUnique({
            where: {
              athleteId_event_implement: {
                athleteId: comp.athleteId,
                event: comp.event,
                implement: implementStr,
              },
            },
          });

          if (!existingPR || r.result > existingPR.distance) {
            await prisma.throwsPR.upsert({
              where: {
                athleteId_event_implement: {
                  athleteId: comp.athleteId,
                  event: comp.event,
                  implement: implementStr,
                },
              },
              update: {
                distance: r.result,
                achievedAt: comp.date,
                source: "COMPETITION",
              },
              create: {
                athleteId: comp.athleteId,
                event: comp.event,
                implement: implementStr,
                distance: r.result,
                achievedAt: comp.date,
                source: "COMPETITION",
              },
            });

            prs.push({
              athleteId: comp.athleteId,
              athleteName: `${comp.athlete.firstName} ${comp.athlete.lastName}`,
              event: comp.event,
              distance: r.result,
              previousBest: existingPR?.distance ?? null,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated: results.length,
      prs,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("coach competitions PATCH error", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to update results" }, { status: 500 });
  }
}
