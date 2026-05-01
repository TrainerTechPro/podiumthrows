import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseQuery } from "@/lib/api-schemas";
import { aggregateHistoryDays, type PRContext } from "@/lib/throws/history";
import { getAthletePRs } from "@/lib/data/personal-records";

const DAYS_PER_PAGE = 30;

const EventEnum = z.enum(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"]);

const HistoryQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d", "ytd", "all", "custom"]).default("30d"),
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  events: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : []))
    .pipe(z.array(EventEnum)),
  implements: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((n) => parseFloat(n))
            .filter((n) => Number.isFinite(n))
        : []
    ),
  prOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  cursor: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  tz: z.string().optional(),
});

function rangeToStartDate(
  range: z.infer<typeof HistoryQuerySchema>["range"],
  start?: string
): Date {
  const now = new Date();
  switch (range) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "ytd":
      return new Date(now.getFullYear(), 0, 1);
    case "all":
      return new Date(0); // epoch
    case "custom":
      return start ? new Date(`${start}T00:00:00`) : new Date(0);
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const parsed = parseQuery(request, HistoryQuerySchema);
    if (parsed instanceof NextResponse) return parsed;
    const { range, start, end, events, implements: implementFilter, prOnly, cursor, tz } = parsed;

    const profile = await prisma.athleteProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true, gender: true },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Athlete profile not found" },
        { status: 403 }
      );
    }

    const startDate = rangeToStartDate(range, start);

    // When a cursor is present it's the ISO date of the oldest day on the
    // previous page. We fetch everything strictly before that date so the
    // next page picks up where the last one left off.
    const endDate = cursor
      ? new Date(`${cursor}T00:00:00`) // midnight of cursor day = exclusive upper bound
      : end
        ? new Date(`${end}T23:59:59`)
        : new Date();

    const startYMD = startDate.toISOString().slice(0, 10);
    // For string-date columns use lt (exclusive) when cursor is set,
    // lte (inclusive) when not.
    const endYMD = cursor ? cursor : (end ?? new Date().toISOString().slice(0, 10));

    const [throwLogs, blockLogs, selfLoggedSessions, athletePRs] = await Promise.all([
      prisma.throwLog.findMany({
        where: {
          athleteId: profile.id,
          date: { gte: startDate, ...(cursor ? { lt: endDate } : { lte: endDate }) },
          ...(events.length > 0 ? { event: { in: events } } : {}),
          ...(implementFilter.length > 0 ? { implementWeight: { in: implementFilter } } : {}),
          ...(prOnly ? { isPersonalBest: true } : {}),
        },
        select: {
          id: true,
          athleteId: true,
          event: true,
          implementId: true,
          implementWeight: true,
          distance: true,
          date: true,
          isPersonalBest: true,
          isCompetition: true,
          isFoul: true,
          sessionId: true,
          notes: true,
          attemptNumber: true,
        },
        orderBy: { date: "desc" },
      }),
      prisma.throwsBlockLog.findMany({
        where: {
          assignment: {
            athleteId: profile.id,
            assignedDate: { gte: startYMD, ...(cursor ? { lt: endYMD } : { lte: endYMD }) },
            status: { in: ["IN_PROGRESS", "COMPLETED"] },
            ...(events.length > 0 ? { session: { event: { in: events } } } : {}),
          },
        },
        include: {
          assignment: {
            select: {
              id: true,
              assignedDate: true,
              athleteId: true,
              status: true,
              session: { select: { event: true, name: true } },
            },
          },
          block: { select: { blockType: true, config: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.athleteThrowsSession.findMany({
        where: {
          athleteId: profile.id,
          date: { gte: startYMD, ...(cursor ? { lt: endYMD } : { lte: endYMD }) },
          ...(events.length > 0 ? { event: { in: events } } : {}),
        },
        include: {
          drillLogs: {
            orderBy: { createdAt: "asc" },
            select: {
              drillType: true,
              implementWeight: true,
              throwCount: true,
              bestMark: true,
            },
          },
        },
        orderBy: { date: "desc" },
      }),
      getAthletePRs(profile.id),
    ]);

    // Build PR context: canonical best distance per event at competition weight.
    const prContext: PRContext = {};
    for (const e of athletePRs.events) {
      const best = Math.max(e.competitionPR?.distance ?? 0, e.practiceBest?.distance ?? 0);
      if (best > 0) {
        prContext[e.event] = { distance: best, weightKg: e.competitionWeightKg };
      }
    }

    const allDays = aggregateHistoryDays({
      throwLogs: throwLogs.map((t) => ({
        id: t.id,
        athleteId: t.athleteId,
        event: t.event,
        implementId: t.implementId,
        implementWeight: t.implementWeight,
        distance: t.distance,
        date: t.date,
        isPersonalBest: t.isPersonalBest,
        isCompetition: t.isCompetition,
        isFoul: t.isFoul,
        sessionId: t.sessionId,
        throwNumber: t.attemptNumber, // schema is attemptNumber, domain calls it throwNumber; both are nullable
        notes: t.notes,
      })),
      blockLogs,
      selfLoggedSessions,
      prContext,
      gender: profile.gender,
      timezone: tz,
    });

    // Paginate: take DAYS_PER_PAGE days, set nextCursor if more remain.
    const pageDays = allDays.slice(0, DAYS_PER_PAGE);
    const nextCursor = allDays.length > DAYS_PER_PAGE ? pageDays[pageDays.length - 1].date : null;

    // Compute totals only on the first page (no cursor). On subsequent
    // pages the client preserves the totals from the initial response.
    const totals = cursor
      ? null
      : {
          sessions: allDays.filter((d) => d.assignmentId != null || d.selfLoggedSessionId != null)
            .length,
          throws: allDays.reduce((sum, d) => sum + d.totalThrows, 0),
        };

    return NextResponse.json({
      success: true,
      data: { days: pageDays, nextCursor, totals },
    });
  } catch (error) {
    logger.error("GET /api/throws/history error", { context: "throws/history", error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
